import { randomUUID } from 'crypto';
import {
  AgentEventSchema,
  AgentRunStartRequestSchema,
  ToolCallEnvelopeSchema,
  type AgentEvent,
  type AgentRunStartRequest,
  type AgentRunStatus,
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

    try {
      for (const toolCall of toolCalls) {
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
}
