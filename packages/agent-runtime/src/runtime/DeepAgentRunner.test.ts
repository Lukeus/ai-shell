import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { AgentEvent, ToolCallEnvelope } from 'packages-api-contracts';
import { DeepAgentRunner } from './DeepAgentRunner';

describe('DeepAgentRunner', () => {
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

    const runner = new DeepAgentRunner({
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

    const runner = new DeepAgentRunner({
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

    await expect(runner.startRun(runId, { goal: 'Read file' }, [toolCall])).rejects.toThrow(
      'tool failed'
    );

    const errorEvent = events.find((event) => event.type === 'error');
    const statusEvents = events.filter((event) => event.type === 'status');

    expect(errorEvent).toBeDefined();
    expect(statusEvents[0]).toMatchObject({ status: 'running' });
    expect(statusEvents[statusEvents.length - 1]).toMatchObject({ status: 'failed' });
  });

  it('emits tool-call and tool-result events for VFS operations', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => {
        // Simulate VFS tool execution
        if (envelope.toolId === 'vfs.read') {
          return {
            callId: envelope.callId,
            toolId: envelope.toolId,
            runId: envelope.runId,
            ok: true,
            output: { content: 'file contents' },
            durationMs: 5,
          };
        }
        return {
          callId: envelope.callId,
          toolId: envelope.toolId,
          runId: envelope.runId,
          ok: false,
          error: 'TOOL_NOT_FOUND',
          durationMs: 0,
        };
      }),
    };

    const runner = new DeepAgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    const vfsReadCall = {
      callId: randomUUID(),
      toolId: 'vfs.read',
      requesterId: 'agent-host',
      runId,
      input: { path: '/workspace/file.txt' },
      reason: 'read file for analysis',
    };

    await runner.startRun(runId, { goal: 'Read workspace file' }, [vfsReadCall]);

    const toolCallEvents = events.filter((e) => e.type === 'tool-call');
    const toolResultEvents = events.filter((e) => e.type === 'tool-result');

    expect(toolCallEvents.length).toBe(1);
    expect(toolResultEvents.length).toBe(1);

    // tool-call event has nested toolCall object
    expect(toolCallEvents[0]).toMatchObject({
      type: 'tool-call',
      runId,
    });
    expect(toolCallEvents[0].type === 'tool-call' && toolCallEvents[0].toolCall.toolId).toBe(
      'vfs.read'
    );

    // tool-result event has nested result object
    expect(toolResultEvents[0]).toMatchObject({
      type: 'tool-result',
      runId,
    });
    expect(toolResultEvents[0].type === 'tool-result' && toolResultEvents[0].result.ok).toBe(true);
  });

  it('handles policy denial for tool calls', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => {
        // Simulate policy denial
        return {
          callId: envelope.callId,
          toolId: envelope.toolId,
          runId: envelope.runId,
          ok: false,
          error: 'POLICY_DENIED',
          durationMs: 0,
        };
      }),
    };

    const runner = new DeepAgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    const deniedCall = {
      callId: randomUUID(),
      toolId: 'vfs.write',
      requesterId: 'agent-host',
      runId,
      input: { path: '/protected/file.txt', content: 'data' },
      reason: 'write to protected path',
    };

    await runner.startRun(runId, { goal: 'Write file' }, [deniedCall]);

    const toolResultEvents = events.filter((e) => e.type === 'tool-result');
    expect(toolResultEvents.length).toBe(1);
    expect(toolResultEvents[0].type === 'tool-result' && toolResultEvents[0].result.ok).toBe(false);
    expect(toolResultEvents[0].type === 'tool-result' && toolResultEvents[0].result.error).toBe(
      'POLICY_DENIED'
    );

    // Verify status completes; denial is recoverable by default.
    const statusEvents = events.filter((e) => e.type === 'status');
    expect(statusEvents[statusEvents.length - 1]).toMatchObject({ status: 'completed' });
  });

  it('invokes model.generate when no tool calls are provided', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => ({
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        output: { text: 'Hello from model' },
        durationMs: 12,
      })),
    };

    type AgentFactory = NonNullable<
      ConstructorParameters<typeof DeepAgentRunner>[0]['createAgent']
    >;
    const createAgent = (({
      model,
    }: {
      model: { invoke: (input: unknown) => Promise<unknown> };
    }) =>
      ({
        streamEvents: async function* () {
          await model.invoke('Summarize changes');
        },
      })) as unknown as AgentFactory;

    const runner = new DeepAgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
      createAgent,
    });

    const runId = randomUUID();
    const connectionId = randomUUID();

    await runner.startRun(runId, {
      goal: 'Summarize changes',
      connectionId,
      config: { modelRef: 'llama3' },
    });

    expect(toolExecutor.executeToolCall).toHaveBeenCalledTimes(1);
    const [call] = toolExecutor.executeToolCall.mock.calls[0] as [ToolCallEnvelope];
    expect(call.toolId).toBe('model.generate');
    expect(call.input).toMatchObject({
      prompt: 'Summarize changes',
      connectionId,
      modelRef: 'llama3',
    });

    const types = events.map((event) => event.type);
    expect(types).toEqual(['status', 'tool-call', 'tool-result', 'log', 'status']);
  });

  it('emits plan and todo events from write_todos updates', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => ({
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        output: { ok: true },
        durationMs: 1,
      })),
    };

    type AgentFactory = NonNullable<
      ConstructorParameters<typeof DeepAgentRunner>[0]['createAgent']
    >;
    const createAgent = (() =>
      ({
        streamEvents: async function* () {
          yield {
            event: 'on_tool_start',
            name: 'write_todos',
            run_id: 'todo-run',
            tags: [],
            metadata: {},
            data: {
              input: {
                todos: [
                  { content: 'Scan repo', status: 'in_progress' },
                  { content: 'Summarize findings', status: 'pending' },
                ],
              },
            },
          };
        },
      })) as unknown as AgentFactory;

    const runner = new DeepAgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
      createAgent,
    });

    const runId = randomUUID();
    await runner.startRun(runId, { goal: 'Review code' });

    const planEvent = events.find((event) => event.type === 'plan');
    const todoEvents = events.filter((event) => event.type === 'todo-update');

    expect(planEvent).toBeDefined();
    expect(todoEvents.length).toBe(2);
  });

  it('emits tool-call events with input data for storage-layer redaction', async () => {
    const events: AgentEvent[] = [];
    const toolExecutor = {
      executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => ({
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        output: { result: 'success' },
        durationMs: 10,
      })),
    };

    const runner = new DeepAgentRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    const toolCall = {
      callId: randomUUID(),
      toolId: 'api.call',
      requesterId: 'agent-host',
      runId,
      input: { apiKey: 'sk-secret-value', endpoint: 'https://api.example.com' },
    };

    await runner.startRun(runId, { goal: 'Call API' }, [toolCall]);

    // DeepAgentRunner emits events as-is; redaction happens at storage layer (AgentRunStore)
    // Verify tool-call event structure is correct
    const toolCallEvents = events.filter((e) => e.type === 'tool-call');
    expect(toolCallEvents.length).toBe(1);
    expect(toolCallEvents[0].type === 'tool-call' && toolCallEvents[0].toolCall.toolId).toBe(
      'api.call'
    );
  });
});
