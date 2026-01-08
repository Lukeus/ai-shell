import { randomUUID } from 'crypto';
import {
  AgentContextAttachmentSchema,
  AgentEditRequestOptionsSchema,
  AgentEventSchema,
  AgentRunStartRequestSchema,
  type AgentContextAttachment,
  type AgentEditProposal,
  type AgentEditRequestOptions,
  type AgentEvent,
  type AgentRunStatus,
  type AgentRunStartRequest,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { parseEditProposalOutput } from './edit-proposal';
import { buildEditPrompt, EDIT_SYSTEM_PROMPT } from './prompts';

export type EditToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type EditWorkflowRunnerOptions = {
  toolExecutor: EditToolExecutor;
  onEvent: (event: AgentEvent) => void;
  now?: () => string;
  idProvider?: () => string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class EditWorkflowRunner {
  private readonly toolExecutor: EditToolExecutor;
  private readonly onEvent: (event: AgentEvent) => void;
  private readonly now: () => string;
  private readonly idProvider: () => string;

  constructor(options: EditWorkflowRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idProvider = options.idProvider ?? randomUUID;
  }

  public async startRun(runId: string, request: AgentRunStartRequest): Promise<void> {
    const validatedRequest = AgentRunStartRequestSchema.parse(request);
    const inputs = this.parseInputs(validatedRequest);
    const attachments = this.parseAttachments(inputs);
    const options = this.parseOptions(inputs);
    const prompt = buildEditPrompt({
      prompt: validatedRequest.goal,
      attachments,
      options,
    });

    this.emitStatus(runId, 'running');

    try {
      const text = await this.generateWithModel(runId, validatedRequest, prompt);
      const proposal = parseEditProposalOutput(text, options);
      const conversationId = this.resolveConversationId(validatedRequest, inputs);

      this.emitEditProposal(runId, proposal, conversationId);
      this.emitStatus(runId, 'completed');
    } catch (error) {
      this.emitError(runId, error);
      this.emitStatus(runId, 'failed');
      throw error;
    }
  }

  private parseInputs(
    request: AgentRunStartRequest
  ): Record<string, JsonValue> | undefined {
    if (!request.inputs || typeof request.inputs !== 'object') {
      return undefined;
    }
    if (Array.isArray(request.inputs)) {
      return undefined;
    }
    return request.inputs as Record<string, JsonValue>;
  }

  private parseAttachments(inputs?: Record<string, JsonValue>): AgentContextAttachment[] {
    if (!inputs) {
      return [];
    }
    const parsed = AgentContextAttachmentSchema.array().safeParse(inputs.attachments);
    return parsed.success ? parsed.data : [];
  }

  private parseOptions(inputs?: Record<string, JsonValue>): AgentEditRequestOptions | undefined {
    if (!inputs) {
      return undefined;
    }
    const parsed = AgentEditRequestOptionsSchema.safeParse(inputs.options);
    return parsed.success ? parsed.data : undefined;
  }

  private resolveConversationId(
    request: AgentRunStartRequest,
    inputs?: Record<string, JsonValue>
  ): string | undefined {
    const metadataValue = request.metadata?.conversationId;
    if (typeof metadataValue === 'string' && UUID_PATTERN.test(metadataValue)) {
      return metadataValue;
    }
    const inputValue = inputs?.conversationId;
    if (typeof inputValue === 'string' && UUID_PATTERN.test(inputValue)) {
      return inputValue;
    }
    return undefined;
  }

  private async generateWithModel(
    runId: string,
    request: AgentRunStartRequest,
    prompt: string
  ): Promise<string> {
    const input: JsonValue = {
      prompt,
      systemPrompt: EDIT_SYSTEM_PROMPT,
    };

    if (request.connectionId) {
      (input as Record<string, JsonValue>).connectionId = request.connectionId;
    }

    if (request.config?.modelRef) {
      (input as Record<string, JsonValue>).modelRef = request.config.modelRef;
    }

    const envelope: ToolCallEnvelope = {
      callId: this.idProvider(),
      toolId: 'model.generate',
      requesterId: 'agent-host',
      runId,
      input,
      reason: 'Edit proposal generation',
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

  private emitEditProposal(
    runId: string,
    proposal: AgentEditProposal,
    conversationId?: string
  ): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'edit-proposal',
      proposal,
      conversationId,
    });
  }

  private emitStatus(runId: string, status: AgentRunStatus): void {
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'status',
      status,
    });
  }

  private emitError(runId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error ?? 'Edit run failed');
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'error',
      message,
    });
  }

  private emitEvent(event: AgentEvent): void {
    const validated = AgentEventSchema.parse(event);
    this.onEvent(validated);
  }
}
