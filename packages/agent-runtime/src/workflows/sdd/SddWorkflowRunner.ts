import { randomUUID } from 'crypto';
import {
  SddRunControlRequestSchema,
  SddRunEventSchema,
  SddRunStartRequestSchema,
  type JsonValue,
  type Proposal,
  type SddRunControlRequest,
  type SddRunEvent,
  type SddRunStartRequest,
  type SddStep,
  type ToolCallEnvelope,
} from 'packages-api-contracts';
import { SDD_SYSTEM_PROMPT, buildSddPrompt } from './prompts';
import type { SddDocPathResolver, SddDocPaths } from './sdd-paths';
import { resolveSddDocPaths } from './sdd-paths';
import { contextToRecord, createContextLoader } from './sdd-context';
import { buildDocProposal, normalizeModelOutput, parseImplementationOutput, resolveTargetPath } from './sdd-proposal';
import { assertConstitutionAligned, assertStepAllowed } from './sdd-validation';
import type { SddContext, SddContextLoader, SddToolExecutor } from './sdd-types';

type RunState = {
  runId: string;
  step: SddStep;
  status: 'running' | 'completed' | 'failed' | 'canceled';
};

type SddWorkflowRunnerOptions = {
  toolExecutor: SddToolExecutor;
  onEvent: (event: SddRunEvent) => void;
  now?: () => string;
  idProvider?: () => string;
  contextLoader?: SddContextLoader;
  docPathResolver?: SddDocPathResolver;
};

export class SddWorkflowRunner {
  private readonly toolExecutor: SddToolExecutor;
  private readonly onEvent: (event: SddRunEvent) => void;
  private readonly now: () => string;
  private readonly idProvider: () => string;
  private readonly contextLoader: SddContextLoader;
  private readonly docPathResolver: SddDocPathResolver;
  private activeRun: RunState | null = null;
  private readonly canceledRuns = new Map<string, string | undefined>();

  constructor(options: SddWorkflowRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idProvider = options.idProvider ?? randomUUID;
    this.docPathResolver = options.docPathResolver ?? resolveSddDocPaths;
    this.contextLoader =
      options.contextLoader ??
      createContextLoader({
        toolExecutor: this.toolExecutor,
        idProvider: this.idProvider,
        docPathResolver: this.docPathResolver,
      });
  }

  /**
   * Starts a new SDD (Specification-Driven Development) workflow run.
   *
   * This method orchestrates the execution of an SDD workflow step, including context loading,
   * validation, and step-specific processing. It manages the lifecycle of the run from start
   * to completion, cancellation, or failure.
   *
   * @param runId - Unique identifier for this workflow run
   * @param request - The SDD run start request containing the feature ID and optional step specification
   *
   * @throws {Error} If the run is canceled via {@link cancelRun}
   * @throws {Error} If constitution alignment check fails
   * @throws {Error} If the requested step is not allowed given the current context
   * @throws {Error} If step execution encounters an error
   *
   * @remarks
   * - Validates the request against {@link SddRunStartRequestSchema}
   * - Defaults to 'spec' step if not specified in the request
   * - Emits events throughout the workflow lifecycle (started, context loaded, step started, completed/canceled/failed)
   * - Supports steps: 'spec', 'plan', 'tasks', and 'implement'
   * - Maintains run state in {@link activeRun} and tracks canceled runs in {@link canceledRuns}
   * - Automatically cleans up run state in the finally block
   *
   * @returns A promise that resolves when the run completes successfully or rejects on failure
   */
  public async startRun(runId: string, request: SddRunStartRequest): Promise<void> {
    const validatedRequest = SddRunStartRequestSchema.parse(request);
    const step = validatedRequest.step ?? 'spec';
    const docPaths = this.resolveDocPaths(validatedRequest.featureId);

    this.activeRun = { runId, step, status: 'running' };
    this.emitStarted(runId, validatedRequest, step);

    try {
      this.assertNotCanceled(runId);

      const context = await this.contextLoader(
        runId,
        validatedRequest.featureId,
        step,
        docPaths
      );
      this.emitContextLoaded(runId, step);

      assertConstitutionAligned(docPaths, context, step);
      assertStepAllowed(step, docPaths, context);

      this.emitStepStarted(runId, step);

      if (step === 'spec' || step === 'plan' || step === 'tasks') {
        await this.handleDocStep(runId, validatedRequest, step, context, docPaths);
      } else if (step === 'implement') {
        await this.handleImplementStep(runId, validatedRequest, context);
      } else {
        this.emitOutputAppended(
          runId,
          `SDD step "${step}" is not implemented yet.`
        );
      }

      this.emitRunCompleted(runId);
      this.activeRun = { runId, step, status: 'completed' };
    } catch (error) {
      if (this.canceledRuns.has(runId)) {
        const reason = this.canceledRuns.get(runId);
        this.activeRun = { runId, step, status: 'canceled' };
        this.emitRunCanceled(runId, reason);
        return;
      }

      this.activeRun = { runId, step, status: 'failed' };
      throw error;
    } finally {
      this.canceledRuns.delete(runId);
      if (this.activeRun?.runId === runId && this.activeRun.status !== 'running') {
        this.activeRun = null;
      }
    }
  }

  public controlRun(request: SddRunControlRequest): void {
    const validated = SddRunControlRequestSchema.parse(request);
    if (validated.action === 'cancel') {
      this.canceledRuns.set(validated.runId, validated.reason);
    }
  }

  private emitStarted(runId: string, request: SddRunStartRequest, step: SddStep): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'started',
      featureId: request.featureId,
      goal: request.goal,
      step,
    });
  }

  private emitContextLoaded(runId: string, step: SddStep): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'contextLoaded',
      step,
    });
  }

  private emitStepStarted(runId: string, step: SddStep): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'stepStarted',
      step,
    });
  }

  private emitOutputAppended(runId: string, content: string): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'outputAppended',
      content,
    });
  }

  private emitRunCompleted(runId: string): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'runCompleted',
    });
  }

  private emitRunCanceled(runId: string, reason?: string): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'runCanceled',
      message: reason,
    });
  }

  private emitEvent(event: SddRunEvent): void {
    const validated = SddRunEventSchema.parse(event);
    this.onEvent(validated);
  }

  private emitProposalReady(runId: string, proposal: Proposal): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'proposalReady',
      proposal,
    });
  }

  private emitApprovalRequired(runId: string, proposal: Proposal): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'approvalRequired',
      proposal,
    });
  }

  private assertNotCanceled(runId: string): void {
    if (!this.canceledRuns.has(runId)) {
      return;
    }
    const reason = this.canceledRuns.get(runId);
    const message = reason ? `SDD run canceled: ${reason}` : 'SDD run canceled.';
    throw new Error(message);
  }

  private async handleDocStep(
    runId: string,
    request: SddRunStartRequest,
    step: 'spec' | 'plan' | 'tasks',
    context: SddContext,
    docPaths: SddDocPaths
  ): Promise<void> {
    const targetPath = resolveTargetPath(step, docPaths);
    const prompt = buildSddPrompt({
      step,
      featureId: request.featureId,
      goal: request.goal,
      targetPath,
      context: contextToRecord(context),
    });

    const text = await this.generateWithModel(runId, request, step, prompt);
    const content = normalizeModelOutput(text);
    const proposal = buildDocProposal(targetPath, content);

    this.emitOutputAppended(runId, `Proposal ready for ${targetPath}.`);
    this.emitProposalReady(runId, proposal);
    this.emitApprovalRequired(runId, proposal);
  }

  private async handleImplementStep(
    runId: string,
    request: SddRunStartRequest,
    context: SddContext
  ): Promise<void> {
    const targetPath = 'multi-file proposal';
    const prompt = buildSddPrompt({
      step: 'implement',
      featureId: request.featureId,
      goal: request.goal,
      targetPath,
      context: contextToRecord(context),
    });

    const text = await this.generateWithModel(runId, request, 'implement', prompt);
    const content = normalizeModelOutput(text);
    const proposal = parseImplementationOutput(content);

    this.emitOutputAppended(
      runId,
      `Implementation proposal ready (${proposal.summary.filesChanged} files).`
    );
    this.emitProposalReady(runId, proposal);
    this.emitApprovalRequired(runId, proposal);
  }

  private resolveDocPaths(featureId: string): SddDocPaths {
    return this.docPathResolver(featureId);
  }

  private async generateWithModel(
    runId: string,
    request: SddRunStartRequest,
    step: SddStep,
    prompt: string
  ): Promise<string> {
    const input: JsonValue = {
      prompt,
      systemPrompt: SDD_SYSTEM_PROMPT,
    };

    if (request.connectionId) {
      (input as Record<string, JsonValue>).connectionId = request.connectionId;
    }

    const envelope: ToolCallEnvelope = {
      callId: this.idProvider(),
      toolId: 'model.generate',
      requesterId: 'agent-host',
      runId,
      input,
      reason: `SDD ${request.featureId} ${step} generation`,
    };

    this.assertNotCanceled(runId);
    const result = await this.toolExecutor.executeToolCall(envelope);
    this.assertNotCanceled(runId);
    if (!result.ok) {
      throw new Error(result.error ?? 'model.generate failed');
    }

    const output = result.output as { text?: unknown };
    if (!output || typeof output.text !== 'string') {
      throw new Error('model.generate returned invalid output');
    }

    return output.text;
  }
}
