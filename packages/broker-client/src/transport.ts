import type { ToolCallEnvelope, ToolCallResult } from 'packages-api-contracts';

export type ToolCallMessage =
  | {
      type: 'agent-host:tool-call';
      payload: ToolCallEnvelope;
    }
  | {
      type: 'agent-host:tool-result';
      payload: ToolCallResult;
    };

export type BrokerClientTransport = {
  send: (message: ToolCallMessage) => void;
  onMessage: (handler: (message: unknown) => void) => () => void;
};

export const createProcessTransport = (): BrokerClientTransport => {
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
