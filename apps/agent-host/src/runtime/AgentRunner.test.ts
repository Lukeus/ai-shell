import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { AgentEvent, ToolCallEnvelope } from 'packages-api-contracts';
import { AgentRunner } from './AgentRunner';

describe('AgentRunner', () => {
  it('emits tool call/result events and completes', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => ({
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        output: { ok: true },
        durationMs: 10,
      })),
    };

    const runner = new AgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    const toolCall = {
      callId: randomUUID(),
      toolId: 'fs.read',
      requesterId: 'agent-host',
      runId,
      input: { path: '/tmp' },
      reason: 'read workspace',
    };

    await runner.startRun(runId, { goal: 'Read file' }, [toolCall]);

    const types = events.map((event) => event.type);
    expect(types).toEqual(['status', 'tool-call', 'tool-result', 'status']);
    expect(events[0]).toMatchObject({ type: 'status', status: 'running' });
    expect(events[3]).toMatchObject({ type: 'status', status: 'completed' });
    expect(toolExecutor.executeToolCall).toHaveBeenCalledWith(toolCall);
  });

  it('emits error and failed status on tool failure', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (_envelope: ToolCallEnvelope) => {
        throw new Error('tool failed');
      }),
    };

    const runner = new AgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    const toolCall = {
      callId: randomUUID(),
      toolId: 'fs.read',
      requesterId: 'agent-host',
      runId,
      input: { path: '/tmp' },
    };

    await expect(runner.startRun(runId, { goal: 'Read file' }, [toolCall]))
      .rejects.toThrow('tool failed');

    const errorEvent = events.find((event) => event.type === 'error');
    const statusEvents = events.filter((event) => event.type === 'status');

    expect(errorEvent).toBeDefined();
    expect(statusEvents[0]).toMatchObject({ status: 'running' });
    expect(statusEvents[statusEvents.length - 1]).toMatchObject({ status: 'failed' });
  });
});
