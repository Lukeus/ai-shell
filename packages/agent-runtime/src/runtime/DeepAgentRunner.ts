import { randomUUID } from 'crypto';
import {
  AgentEventSchema,
  AgentRunStartRequestSchema,
  ToolCallEnvelopeSchema,
  type AgentEvent,
  type AgentRunStartRequest,
  type AgentRunStatus,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';

export type ToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type AgentRunnerOptions = {
  toolExecutor: ToolExecutor;
  onEvent: (event: AgentEvent) => void;
};

/**
 * DeepAgentRunner - orchestrates agent runs with tool execution.
 *
 * Note: This is a stub implementation prepared for future deepagentsjs integration.
 * Currently handles basic tool call orchestration and event emission.
 */
export class DeepAgentRunner {
  private readonly toolExecutor: ToolExecutor;
  private readonly onEvent: (event: AgentEvent) => void;

  constructor(options: AgentRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
  }

  public async startRun(
    runId: string,
    request: AgentRunStartRequest,
    toolCalls: ToolCallEnvelope[] = []
  ): Promise<void> {
    AgentRunStartRequestSchema.parse(request);
    this.emitStatus(runId, 'running');
    const activeToolCalls =
      toolCalls.length > 0 ? toolCalls : [this.buildModelGenerateCall(runId, request)];

    try {
      for (const toolCall of activeToolCalls) {
        const validatedCall = ToolCallEnvelopeSchema.parse(toolCall);
        if (validatedCall.runId !== runId) {
          throw new Error(`Tool call runId mismatch: ${validatedCall.runId}`);
        }

        this.emitEvent({
          id: randomUUID(),
          runId,
          timestamp: new Date().toISOString(),
          type: 'tool-call',
          toolCall: validatedCall,
        });

        const result = await this.toolExecutor.executeToolCall(validatedCall);
        this.emitEvent({
          id: randomUUID(),
          runId,
          timestamp: new Date().toISOString(),
          type: 'tool-result',
          result,
        });

        if (!result.ok) {
          throw new Error(result.error ?? 'Tool call failed');
        }

        if (validatedCall.toolId === 'model.generate') {
          this.emitModelLog(runId, result.output);
        }
      }

      this.emitStatus(runId, 'completed');
    } catch (error) {
      this.emitError(runId, error);
      this.emitStatus(runId, 'failed');
      throw error;
    }
  }

  private emitStatus(runId: string, status: AgentRunStatus): void {
    this.emitEvent({
      id: randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      type: 'status',
      status,
    });
  }

  private emitError(runId: string, error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Agent run failed unexpectedly';
    this.emitEvent({
      id: randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      type: 'error',
      message,
    });
  }

  private emitEvent(event: AgentEvent): void {
    const validated = AgentEventSchema.parse(event);
    this.onEvent(validated);
  }

  private buildModelGenerateCall(
    runId: string,
    request: AgentRunStartRequest
  ): ToolCallEnvelope {
    const input: Record<string, unknown> = {
      prompt: request.goal,
    };

    if (request.connectionId) {
      input.connectionId = request.connectionId;
    }

    if (request.config?.modelRef) {
      input.modelRef = request.config.modelRef;
    }

    return {
      callId: randomUUID(),
      toolId: 'model.generate',
      requesterId: 'agent-host',
      runId,
      input: input as JsonValue,
      reason: 'Generate model response',
    };
  }

  private emitModelLog(runId: string, output?: unknown): void {
    if (!output || typeof output !== 'object') {
      return;
    }

    const textValue = (output as { text?: unknown }).text;
    if (typeof textValue !== 'string' || textValue.trim().length === 0) {
      return;
    }

    const normalized = textValue.replace(/\s+/g, ' ').trim();
    const truncated =
      normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;

    this.emitEvent({
      id: randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      type: 'log',
      level: 'info',
      message: truncated,
    });
  }
}
