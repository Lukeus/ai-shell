import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { ToolCallEnvelope } from 'packages-api-contracts';
import { BrokerClient } from './index';
import type { BrokerClientTransport } from './transport';

type MockTransport = {
  transport: BrokerClientTransport;
  emit: (message: unknown) => void;
};

const createMockTransport = (): MockTransport => {
  let handler: ((message: unknown) => void) | null = null;

  return {
    transport: {
      send: vi.fn(),
      onMessage: (next) => {
        handler = next;
        return () => {
          handler = null;
        };
      },
    },
    emit: (message) => {
      handler?.(message);
    },
  };
};

const createEnvelope = (): ToolCallEnvelope => ({
  callId: randomUUID(),
  toolId: 'workspace.read',
  requesterId: 'agent-host',
  runId: randomUUID(),
  input: { path: 'README.md' },
});

describe('BrokerClient', () => {
  it('sends tool calls and resolves results', async () => {
    const mock = createMockTransport();
    const client = new BrokerClient({ transport: mock.transport, timeoutMs: 1000 });
    const envelope = createEnvelope();

    const promise = client.executeToolCall(envelope);

    expect(mock.transport.send).toHaveBeenCalledWith({
      type: 'agent-host:tool-call',
      payload: envelope,
    });

    mock.emit({
      type: 'agent-host:tool-result',
      payload: {
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        durationMs: 10,
        output: { content: 'ok' },
      },
    });

    await expect(promise).resolves.toMatchObject({ ok: true });
    client.dispose();
  });

  it('rejects when a tool call times out', async () => {
    vi.useFakeTimers();
    const mock = createMockTransport();
    const client = new BrokerClient({ transport: mock.transport, timeoutMs: 20 });
    const envelope = createEnvelope();

    const promise = client.executeToolCall(envelope);
    const rejection = expect(promise).rejects.toThrow(
      `Tool call timed out: ${envelope.callId}`
    );
    await vi.advanceTimersByTimeAsync(30);

    await rejection;
    client.dispose();
    vi.useRealTimers();
  });

  it('rejects invalid tool result payloads with matching callId', async () => {
    const mock = createMockTransport();
    const client = new BrokerClient({ transport: mock.transport, timeoutMs: 1000 });
    const envelope = createEnvelope();

    const promise = client.executeToolCall(envelope);

    mock.emit({
      type: 'agent-host:tool-result',
      payload: {
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: 'nope',
      },
    });

    await expect(promise).rejects.toThrow('Invalid tool result payload');
    client.dispose();
  });

  it('rejects duplicate call ids', async () => {
    const mock = createMockTransport();
    const client = new BrokerClient({ transport: mock.transport, timeoutMs: 1000 });
    const envelope = createEnvelope();

    const first = client.executeToolCall(envelope);

    await expect(client.executeToolCall(envelope)).rejects.toThrow(
      `Duplicate tool call id: ${envelope.callId}`
    );

    mock.emit({
      type: 'agent-host:tool-result',
      payload: {
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        durationMs: 5,
      },
    });

    await expect(first).resolves.toMatchObject({ ok: true });
    client.dispose();
  });
});
