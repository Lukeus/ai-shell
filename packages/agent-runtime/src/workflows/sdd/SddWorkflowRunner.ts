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
  ProposalSchema,
  type ToolCallEnvelope,
  type ToolCallResult,
  JsonValue,
} from 'packages-api-contracts';
import { SDD_SYSTEM_PROMPT, buildSddPrompt } from './prompts';
import type { SddDocPaths, SddDocPathResolver } from './sdd-paths';
import { resolveSddDocPaths } from './sdd-paths';

export type SddToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type SddContext = {
  files: Map<string, string>;
};

type SddContextLoader = (
  runId: string,
  featureId: string,
  docPaths?: SddDocPaths
) => Promise<SddContext>;

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

const buildMandatoryContextPaths = (docPaths: SddDocPaths): string[] => [
  'memory/constitution.md',
  'memory/context/00-overview.md',
  docPaths.specPath,
  docPaths.planPath,
  docPaths.tasksPath,
  'docs/architecture/architecture.md',
];

const CONSTITUTION_ALIGNMENT_PATTERNS = [
  /constitution alignment/i,
  /aligned with memory\/constitution\.md/i,
];

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
      ((runId, featureId, docPaths) =>
        this.loadMandatoryContext(runId, featureId, docPaths));
  }

  public async startRun(runId: string, request: SddRunStartRequest): Promise<void> {
    const validatedRequest = SddRunStartRequestSchema.parse(request);
    const step = validatedRequest.step ?? 'spec';
    const docPaths = this.resolveDocPaths(validatedRequest.featureId);

    this.activeRun = { runId, step, status: 'running' };
    this.emitStarted(runId, validatedRequest, step);

    try {
      this.assertNotCanceled(runId);

      const context = await this.contextLoader(runId, validatedRequest.featureId, docPaths);
      this.emitContextLoaded(runId, step);

      this.assertConstitutionAligned(docPaths, context);
      this.assertStepAllowed(step, docPaths, context);

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

  private assertStepAllowed(step: SddStep, docPaths: SddDocPaths, context: SddContext): void {
    const { specPath, planPath, tasksPath } = docPaths;
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

  private assertConstitutionAligned(docPaths: SddDocPaths, context: SddContext): void {
    const requiredPaths = [docPaths.specPath, docPaths.planPath, docPaths.tasksPath];
    const missing: string[] = [];
    const misaligned: string[] = [];

    for (const path of requiredPaths) {
      const content = context.files.get(path);
      if (!content) {
        missing.push(path);
        continue;
      }
      const aligned = CONSTITUTION_ALIGNMENT_PATTERNS.some((pattern) => pattern.test(content));
      if (!aligned) {
        misaligned.push(path);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `SDD constitution alignment check failed. Missing files: ${missing.join(', ')}`
      );
    }

    if (misaligned.length > 0) {
      throw new Error(
        'SDD constitution alignment check failed. ' +
        'Add a "Constitution alignment" section referencing memory/constitution.md to: ' +
        misaligned.join(', ')
      );
    }
  }

  private async handleDocStep(
    runId: string,
    request: SddRunStartRequest,
    step: 'spec' | 'plan' | 'tasks',
    context: SddContext,
    docPaths: SddDocPaths
  ): Promise<void> {
    const targetPath = this.resolveTargetPath(step, docPaths);
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
      context: this.contextToRecord(context),
    });

    const text = await this.generateWithModel(runId, request, 'implement', prompt);
    const content = this.normalizeModelOutput(text);
    const proposal = this.parseImplementationOutput(content);

    this.emitOutputAppended(runId, `Implementation proposal ready (${proposal.summary.filesChanged} files).`);
    this.emitProposalReady(runId, proposal);
    this.emitApprovalRequired(runId, proposal);
  }

  private resolveTargetPath(step: 'spec' | 'plan' | 'tasks', docPaths: SddDocPaths): string {
    if (step === 'spec') {
      return docPaths.specPath;
    }
    if (step === 'plan') {
      return docPaths.planPath;
    }
    return docPaths.tasksPath;
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

  private parseImplementationOutput(output: string): Proposal {
    const trimmed = output.trim();
    if (trimmed.length === 0) {
      throw new Error('SDD implement step returned empty output.');
    }

    const jsonProposal = this.tryParseProposalJson(trimmed);
    if (jsonProposal) {
      return jsonProposal;
    }

    const patchFileCount = this.countFilesInPatch(trimmed);
    const proposal = {
      writes: [],
      patch: trimmed,
      summary: {
        filesChanged: Math.max(1, patchFileCount),
      },
    };

    return ProposalSchema.parse(proposal);
  }

  private tryParseProposalJson(output: string): Proposal | null {
    const startsLikeJson = output.startsWith('{') || output.startsWith('[');
    if (!startsLikeJson) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch (error) {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const writes = Array.isArray(record.writes)
      ? record.writes
          .map((write) => {
            if (!write || typeof write !== 'object') {
              return null;
            }
            const entry = write as Record<string, unknown>;
            if (typeof entry.path !== 'string' || entry.path.length === 0) {
              return null;
            }
            if (typeof entry.content !== 'string') {
              return null;
            }
            return { path: entry.path, content: entry.content };
          })
          .filter((write): write is { path: string; content: string } => Boolean(write))
      : [];
    const patch = typeof record.patch === 'string' && record.patch.trim().length > 0
      ? record.patch
      : undefined;
    const summaryInput = record.summary && typeof record.summary === 'object'
      ? (record.summary as Record<string, unknown>)
      : undefined;
    const filesFromPatch = patch ? this.countFilesInPatch(patch) : 0;
    const filesChangedFallback = Math.max(writes.length, filesFromPatch, patch ? 1 : 0);
    const summary = {
      filesChanged: typeof summaryInput?.filesChanged === 'number'
        ? summaryInput.filesChanged
        : filesChangedFallback,
      additions: typeof summaryInput?.additions === 'number'
        ? summaryInput.additions
        : undefined,
      deletions: typeof summaryInput?.deletions === 'number'
        ? summaryInput.deletions
        : undefined,
    };

    if (writes.length === 0 && !patch) {
      throw new Error('SDD implement output did not include any writes or patch.');
    }

    return ProposalSchema.parse({
      writes,
      patch,
      summary,
    });
  }

  private countFilesInPatch(patch: string): number {
    const diffMatches = patch.match(/^diff --git /gm);
    if (diffMatches && diffMatches.length > 0) {
      return diffMatches.length;
    }
    const plusPlusMatches = patch.match(/^\+\+\+ /gm);
    return plusPlusMatches ? plusPlusMatches.length : 0;
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

  private async loadMandatoryContext(
    runId: string,
    featureId: string,
    docPaths?: SddDocPaths
  ): Promise<SddContext> {
    const files = new Map<string, string>();
    const missing: string[] = [];
    const resolvedDocPaths = docPaths ?? this.resolveDocPaths(featureId);

    for (const path of buildMandatoryContextPaths(resolvedDocPaths)) {
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

  private resolveDocPaths(featureId: string): SddDocPaths {
    return this.docPathResolver(featureId);
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
