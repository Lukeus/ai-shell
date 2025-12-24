import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { SddRunEvent, ToolCallEnvelope } from 'packages-api-contracts';
import { SddWorkflowRunner } from 'packages-agent-runtime';

type FileMap = Record<string, string>;

const buildContextFiles = (featureId: string): FileMap => ({
  'memory/constitution.md': 'constitution',
  'memory/context/00-overview.md': 'overview',
  [`specs/${featureId}/spec.md`]: 'spec',
  [`specs/${featureId}/plan.md`]: 'plan',
  [`specs/${featureId}/tasks.md`]: 'tasks',
  'docs/architecture/architecture.md': 'architecture',
});

const createToolExecutor = (files: FileMap, modelText: string) => ({
  executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => {
    if (envelope.toolId === 'workspace.read') {
      const input = envelope.input as { path?: string };
      const path = typeof input?.path === 'string' ? input.path : '';

      if (!path || !(path in files)) {
        return {
          callId: envelope.callId,
          toolId: envelope.toolId,
          runId: envelope.runId,
          ok: false,
          error: `ENOENT: ${path}`,
        };
      }

      return {
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        output: { content: files[path], encoding: 'utf-8' },
      };
    }

    if (envelope.toolId === 'model.generate') {
      return {
        callId: envelope.callId,
        toolId: envelope.toolId,
        runId: envelope.runId,
        ok: true,
        output: { text: modelText },
      };
    }

    return {
      callId: envelope.callId,
      toolId: envelope.toolId,
      runId: envelope.runId,
      ok: false,
      error: 'TOOL_NOT_SUPPORTED',
    };
  }),
});

describe('SddWorkflowRunner', () => {
  it('emits step transitions for a spec run', async () => {
    const featureId = '151-sdd-workflow';
    const toolExecutor = createToolExecutor(buildContextFiles(featureId), 'Spec output');
    const events: SddRunEvent[] = [];
    const runner = new SddWorkflowRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    await runner.startRun(runId, { featureId, goal: 'Test SDD', step: 'spec' });

    const eventTypes = events.map((event) => event.type);
    expect(eventTypes).toEqual([
      'started',
      'contextLoaded',
      'stepStarted',
      'outputAppended',
      'proposalReady',
      'approvalRequired',
      'runCompleted',
    ]);
    expect(events[2]).toMatchObject({ type: 'stepStarted', step: 'spec' });
  });

  it('fails when required context files are missing', async () => {
    const featureId = '151-sdd-workflow';
    const files = buildContextFiles(featureId);
    delete files[`specs/${featureId}/spec.md`];

    const toolExecutor = createToolExecutor(files, 'Plan output');
    const events: SddRunEvent[] = [];
    const runner = new SddWorkflowRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    await expect(
      runner.startRun(runId, { featureId, goal: 'Test SDD', step: 'plan' })
    ).rejects.toThrow(`specs/${featureId}/spec.md`);

    expect(events[0]).toMatchObject({ type: 'started' });
    expect(events.find((event) => event.type === 'contextLoaded')).toBeUndefined();
  });

  it('builds a plan proposal from model output', async () => {
    const featureId = '151-sdd-workflow';
    const toolExecutor = createToolExecutor(buildContextFiles(featureId), 'Plan content');
    const events: SddRunEvent[] = [];
    const runner = new SddWorkflowRunner({
      toolExecutor,
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    await runner.startRun(runId, { featureId, goal: 'Plan step', step: 'plan' });

    const proposalEvent = events.find((event) => event.type === 'proposalReady');
    expect(proposalEvent?.type).toBe('proposalReady');
    if (proposalEvent?.type === 'proposalReady') {
      expect(proposalEvent.proposal.writes[0]).toMatchObject({
        path: `specs/${featureId}/plan.md`,
        content: 'Plan content',
      });
    }
  });
});
