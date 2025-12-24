import { randomUUID } from 'crypto';
import {
  SddRunControlRequestSchema,
  SddRunEventSchema,
  SddRunStartRequestSchema,
  type SddRunControlRequest,
  type SddRunEvent,
  type SddRunStartRequest,
  type SddStep,
  type Proposal,
  type ToolCallEnvelope,
  type ToolCallResult,
  JsonValue,
} from 'packages-api-contracts';
import { SDD_SYSTEM_PROMPT, buildSddPrompt } from './prompts';

export type SddToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type SddContext = {
  files: Map<string, string>;
};

type SddContextLoader = (runId: string, featureId: string) => Promise<SddContext>;

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
};

const buildMandatoryContextPaths = (featureId: string): string[] => [
  'memory/constitution.md',
  'memory/context/00-overview.md',
  `specs/${featureId}/spec.md`,
  `specs/${featureId}/plan.md`,
  `specs/${featureId}/tasks.md`,
  'docs/architecture/architecture.md',
];

export class SddWorkflowRunner {
  private readonly toolExecutor: SddToolExecutor;
  private readonly onEvent: (event: SddRunEvent) => void;
  private readonly now: () => string;
  private readonly idProvider: () => string;
  private readonly contextLoader: SddContextLoader;
  private activeRun: RunState | null = null;
  private readonly canceledRuns = new Map<string, string | undefined>();

  constructor(options: SddWorkflowRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idProvider = options.idProvider ?? randomUUID;
    this.contextLoader =
      options.contextLoader ?? ((runId, featureId) => this.loadMandatoryContext(runId, featureId));
  }

  public async startRun(runId: string, request: SddRunStartRequest): Promise<void> {
    const validatedRequest = SddRunStartRequestSchema.parse(request);
    const step = validatedRequest.step ?? 'spec';

    this.activeRun = { runId, step, status: 'running' };
    this.emitStarted(runId, validatedRequest, step);

    try {
      this.assertNotCanceled(runId);

      const context = await this.contextLoader(runId, validatedRequest.featureId);
      this.emitContextLoaded(runId, step);

      this.assertStepAllowed(step, validatedRequest.featureId, context);

      this.emitStepStarted(runId, step);

      if (step === 'spec' || step === 'plan' || step === 'tasks') {
        await this.handleDocStep(runId, validatedRequest, step, context);
      } else {
        this.emitOutputAppended(
          runId,
          `SDD step "${step}" is not implemented yet.`
        );
      }

      this.emitRunCompleted(runId);
      this.activeRun = { runId, step, status: 'completed' };
    } catch (error) {
      const status = this.canceledRuns.has(runId) ? 'canceled' : 'failed';
      this.activeRun = { runId, step, status };
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
      return;
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

  private assertStepAllowed(step: SddStep, featureId: string, context: SddContext): void {
    const specPath = `specs/${featureId}/spec.md`;
    const planPath = `specs/${featureId}/plan.md`;
    const tasksPath = `specs/${featureId}/tasks.md`;
    const missing: string[] = [];

    if (step !== 'spec' && !context.files.has(specPath)) {
      missing.push(specPath);
    }

    if ((step === 'tasks' || step === 'implement' || step === 'review') && !context.files.has(planPath)) {
      missing.push(planPath);
    }

    if ((step === 'implement' || step === 'review') && !context.files.has(tasksPath)) {
      missing.push(tasksPath);
    }

    if (missing.length > 0) {
      throw new Error(
        `SDD step "${step}" requires the following files: ${missing.join(', ')}`
      );
    }
  }

  private async handleDocStep(
    runId: string,
    request: SddRunStartRequest,
    step: 'spec' | 'plan' | 'tasks',
    context: SddContext
  ): Promise<void> {
    const targetPath = this.resolveTargetPath(step, request.featureId);
    const prompt = buildSddPrompt({
      step,
      featureId: request.featureId,
      goal: request.goal,
      targetPath,
      context: this.contextToRecord(context),
    });

    const text = await this.generateWithModel(runId, request, step, prompt);
    const content = this.normalizeModelOutput(text);
    const proposal = this.buildProposal(targetPath, content);

    this.emitOutputAppended(runId, `Proposal ready for ${targetPath}.`);
    this.emitProposalReady(runId, proposal);
    this.emitApprovalRequired(runId, proposal);
  }

  private resolveTargetPath(step: 'spec' | 'plan' | 'tasks', featureId: string): string {
    if (step === 'spec') {
      return `specs/${featureId}/spec.md`;
    }
    if (step === 'plan') {
      return `specs/${featureId}/plan.md`;
    }
    return `specs/${featureId}/tasks.md`;
  }

  private contextToRecord(context: SddContext): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [path, content] of context.files.entries()) {
      record[path] = content;
    }
    return record;
  }

  private buildProposal(path: string, content: string): Proposal {
    return {
      writes: [{ path, content }],
      summary: {
        filesChanged: 1,
      },
    };
  }

  private normalizeModelOutput(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
    const normalized = match ? match[1].trimEnd() : trimmed;
    if (normalized.length === 0) {
      throw new Error('model.generate returned empty output');
    }
    return normalized;
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

    const result = await this.toolExecutor.executeToolCall(envelope);
    if (!result.ok) {
      throw new Error(result.error ?? 'model.generate failed');
    }

    const output = result.output as { text?: unknown };
    if (!output || typeof output.text !== 'string') {
      throw new Error('model.generate returned invalid output');
    }

    return output.text;
  }

  private async loadMandatoryContext(runId: string, featureId: string): Promise<SddContext> {
    const files = new Map<string, string>();
    const missing: string[] = [];

    for (const path of buildMandatoryContextPaths(featureId)) {
      try {
        const content = await this.readWorkspaceFile(runId, path);
        files.set(path, content);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'read failed';
        missing.push(`${path} (${message})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required context files: ${missing.join(', ')}`);
    }

    return { files };
  }

  private async readWorkspaceFile(runId: string, path: string): Promise<string> {
    const input: JsonValue = { path };
    const envelope: ToolCallEnvelope = {
      callId: this.idProvider(),
      toolId: 'workspace.read',
      requesterId: 'agent-host',
      runId,
      input,
      reason: `Load SDD context: ${path}`,
    };

    const result = await this.toolExecutor.executeToolCall(envelope);
    if (!result.ok) {
      throw new Error(result.error ?? 'workspace.read failed');
    }

    const output = result.output as { content?: unknown };
    if (!output || typeof output.content !== 'string') {
      throw new Error('workspace.read returned invalid content');
    }

    return output.content;
  }
}
