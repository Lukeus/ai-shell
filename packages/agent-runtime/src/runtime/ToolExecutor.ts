import type { ToolCallEnvelope, ToolCallResult } from 'packages-api-contracts';
import { BrokerClient } from 'packages-broker-client';
import type { BrokerClientTransport } from 'packages-broker-client';

type ToolExecutorOptions = {
  transport?: BrokerClientTransport;
  timeoutMs?: number;
};

export type ToolExecutorTransport = BrokerClientTransport;

export class ToolExecutor {
  private readonly client: BrokerClient;

  constructor(options: ToolExecutorOptions = {}) {
    this.client = new BrokerClient({
      transport: options.transport,
      timeoutMs: options.timeoutMs,
    });
  }

  public async executeToolCall(envelope: ToolCallEnvelope): Promise<ToolCallResult> {
    return this.client.executeToolCall(envelope);
  }

  public dispose(): void {
    this.client.dispose();
  }
}
