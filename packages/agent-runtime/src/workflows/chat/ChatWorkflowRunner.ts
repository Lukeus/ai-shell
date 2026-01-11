import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  AgentContextAttachmentSchema,
  AgentEventSchema,
  AgentMessageRoleSchema,
  AgentRunStartRequestSchema,
  type AgentContextAttachment,
  type AgentEvent,
  type AgentMessageRole,
  type AgentRunStartRequest,
  type AgentRunStatus,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { buildChatPrompt, CHAT_SYSTEM_PROMPT, type ChatHistoryEntry } from './prompts';

export type ChatToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type ChatWorkflowRunnerOptions = {
  toolExecutor: ChatToolExecutor;
  onEvent: (event: AgentEvent) => void;
  now?: () => string;
  idProvider?: () => string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ChatHistoryEntrySchema = z.object({
  role: AgentMessageRoleSchema,
  content: z.string().min(1),
  createdAt: z.string().datetime().optional(),
});

export class ChatWorkflowRunner {
  private readonly toolExecutor: ChatToolExecutor;
  private readonly onEvent: (event: AgentEvent) => void;
  private readonly now: () => string;
  private readonly idProvider: () => string;

  constructor(options: ChatWorkflowRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idProvider = options.idProvider ?? randomUUID;
  }

  public async startRun(runId: string, request: AgentRunStartRequest): Promise<void> {
    const validatedRequest = AgentRunStartRequestSchema.parse(request);
    const inputs = this.parseInputs(validatedRequest);
    const attachments = this.parseAttachments(inputs);
    const history = this.parseHistory(inputs);
    const prompt = buildChatPrompt({
      prompt: validatedRequest.goal,
      attachments,
      history,
    });

    this.emitStatus(runId, 'running');

    try {
      const text = await this.generateWithModel(runId, validatedRequest, prompt);
      const conversationId = this.resolveConversationId(validatedRequest, inputs);
      this.emitMessage(runId, text, conversationId);
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

  private parseHistory(inputs?: Record<string, JsonValue>): ChatHistoryEntry[] {
    if (!inputs) {
      return [];
    }
    const parsed = ChatHistoryEntrySchema.array().safeParse(inputs.history);
    return parsed.success ? parsed.data : [];
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
      systemPrompt: CHAT_SYSTEM_PROMPT,
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
      reason: 'Chat response generation',
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

  private emitMessage(
    runId: string,
    content: string,
    conversationId?: string
  ): void {
    const trimmed = content.trim();
    const role: AgentMessageRole = 'agent';
    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'message',
      role,
      content: trimmed.length > 0 ? trimmed : content,
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
    const message = error instanceof Error ? error.message : String(error ?? 'Chat run failed');
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
