import { ToolCallEnvelopeSchema, ToolCallResultSchema } from 'packages-api-contracts';
import type { ToolCallEnvelope, ToolCallResult } from 'packages-api-contracts';

type ToolCallMessage =
  | {
      type: 'agent-host:tool-call';
      payload: ToolCallEnvelope;
    }
  | {
      type: 'agent-host:tool-result';
      payload: ToolCallResult;
    };

export type ToolExecutorTransport = {
  send: (message: ToolCallMessage) => void;
  onMessage: (handler: (message: unknown) => void) => () => void;
};

type ToolExecutorOptions = {
  transport?: ToolExecutorTransport;
  timeoutMs?: number;
};

const createProcessTransport = (): ToolExecutorTransport => {
  if (typeof process.send !== 'function') {
    throw new Error('process.send is not available; cannot reach broker-main');
  }

  return {
    send: (message) => {
      process.send?.(message);
    },
    onMessage: (handler) => {
      const listener = (message: unknown) => handler(message);
      process.on('message', listener);
      return () => {
        process.removeListener('message', listener);
      };
    },
  };
};

const parseToolResult = (message: unknown): ToolCallResult | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const candidate = message as { type?: unknown; payload?: unknown };
  if (candidate.type !== 'agent-host:tool-result') {
    return null;
  }
  const parsed = ToolCallResultSchema.safeParse(candidate.payload);
  return parsed.success ? parsed.data : null;
};

export class ToolExecutor {
  private readonly transport: ToolExecutorTransport;
  private readonly timeoutMs: number;

  constructor(options: ToolExecutorOptions = {}) {
    this.transport = options.transport ?? createProcessTransport();
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  public async executeToolCall(envelope: ToolCallEnvelope): Promise<ToolCallResult> {
    const validated = ToolCallEnvelopeSchema.parse(envelope);

    return new Promise<ToolCallResult>((resolve, reject) => {
      let settled = false;

      const cleanup = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        fn();
      };

      const unsubscribe = this.transport.onMessage((message) => {
        const result = parseToolResult(message);
        if (!result || result.callId !== validated.callId) {
          return;
        }
        cleanup(() => resolve(result));
      });

      const timeout = setTimeout(() => {
        cleanup(() => reject(new Error(`Tool call timed out: ${validated.callId}`)));
      }, this.timeoutMs);

      try {
        this.transport.send({ type: 'agent-host:tool-call', payload: validated });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to send tool call');
        cleanup(() => reject(err));
      }
    });
  }
}
