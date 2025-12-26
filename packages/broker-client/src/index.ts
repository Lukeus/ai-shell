import {
  ToolCallEnvelopeSchema,
  ToolCallResultSchema,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { createProcessTransport, type BrokerClientTransport } from './transport';

type BrokerClientOptions = {
  transport?: BrokerClientTransport;
  timeoutMs?: number;
};

type PendingCall = {
  resolve: (result: ToolCallResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type ParsedToolResult =
  | { result: ToolCallResult }
  | { error: string; callId?: string }
  | null;

export class BrokerClient {
  private readonly transport: BrokerClientTransport;
  private readonly timeoutMs: number;
  private readonly pending = new Map<string, PendingCall>();
  private unsubscribe?: () => void;

  constructor(options: BrokerClientOptions = {}) {
    this.transport = options.transport ?? createProcessTransport();
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.attachListener();
  }

  public async executeToolCall(envelope: ToolCallEnvelope): Promise<ToolCallResult> {
    const validated = ToolCallEnvelopeSchema.parse(envelope);

    if (this.pending.has(validated.callId)) {
      throw new Error(`Duplicate tool call id: ${validated.callId}`);
    }

    return new Promise<ToolCallResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(validated.callId);
        reject(new Error(`Tool call timed out: ${validated.callId}`));
      }, this.timeoutMs);

      this.pending.set(validated.callId, { resolve, reject, timer });

      try {
        this.transport.send({ type: 'agent-host:tool-call', payload: validated });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(validated.callId);
        const err = error instanceof Error ? error : new Error('Failed to send tool call');
        reject(err);
      }
    });
  }

  public dispose(): void {
    for (const [callId, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`BrokerClient disposed before completion: ${callId}`));
    }
    this.pending.clear();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  private attachListener(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = this.transport.onMessage((message) => {
      const parsed = this.parseToolResult(message);
      if (!parsed) {
        return;
      }

      if ('error' in parsed) {
        if (!parsed.callId) {
          return;
        }
        const pending = this.pending.get(parsed.callId);
        if (!pending) {
          return;
        }
        clearTimeout(pending.timer);
        this.pending.delete(parsed.callId);
        pending.reject(new Error(parsed.error));
        return;
      }

      const pending = this.pending.get(parsed.result.callId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(parsed.result.callId);
      pending.resolve(parsed.result);
    });
  }

  private parseToolResult(message: unknown): ParsedToolResult {
    if (!message || typeof message !== 'object') {
      return null;
    }

    const candidate = message as { type?: unknown; payload?: unknown };
    if (candidate.type !== 'agent-host:tool-result') {
      return null;
    }

    const parsed = ToolCallResultSchema.safeParse(candidate.payload);
    if (parsed.success) {
      return { result: parsed.data };
    }

    const payload = candidate.payload as { callId?: unknown } | undefined;
    const callId = typeof payload?.callId === 'string' ? payload.callId : undefined;
    return { error: 'Invalid tool result payload', callId };
  }
}

export type { BrokerClientTransport } from './transport';
export { createProcessTransport } from './transport';
