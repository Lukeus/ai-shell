import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type {
  AgentEvent,
  AgentRunStartRequest,
  ToolCallEnvelope,
} from 'packages-api-contracts';
import { EditWorkflowRunner } from './EditWorkflowRunner';

const createToolExecutor = (modelText: string) => ({
  executeToolCall: vi.fn(async (envelope: ToolCallEnvelope) => ({
    callId: envelope.callId,
    toolId: envelope.toolId,
    runId: envelope.runId,
    ok: true,
    output: { text: modelText },
  })),
});

const buildRequest = (partial: Partial<AgentRunStartRequest>): AgentRunStartRequest => ({
  goal: 'Update selected code',
  ...partial,
});

describe('EditWorkflowRunner', () => {
  it('emits edit-proposal event from JSON output', async () => {
    const conversationId = randomUUID();
    const modelText = JSON.stringify({
      summary: 'Update helper',
      proposal: {
        writes: [{ path: 'src/helpers/foo.ts', content: 'export const foo = 1;\n' }],
        summary: { filesChanged: 1 },
      },
    });
    const events: AgentEvent[] = [];
    const runner = new EditWorkflowRunner({
      toolExecutor: createToolExecutor(modelText),
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    await runner.startRun(
      runId,
      buildRequest({
        metadata: { workflow: 'edit', conversationId },
        inputs: { attachments: [] },
      })
    );

    const eventTypes = events.map((event) => event.type);
    expect(eventTypes).toEqual(['status', 'edit-proposal', 'status']);

    const proposalEvent = events.find((event) => event.type === 'edit-proposal');
    expect(proposalEvent?.type).toBe('edit-proposal');
    if (proposalEvent?.type === 'edit-proposal') {
      expect(proposalEvent.conversationId).toBe(conversationId);
      expect(proposalEvent.proposal.proposal.writes).toHaveLength(1);
      expect(proposalEvent.proposal.summary).toBe('Update helper');
    }
  });

  it('parses patch output into a proposal', async () => {
    const patch = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1 +1 @@',
      '-const foo = 1;',
      '+const foo = 2;',
    ].join('\n');
    const events: AgentEvent[] = [];
    const runner = new EditWorkflowRunner({
      toolExecutor: createToolExecutor(patch),
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    await runner.startRun(
      runId,
      buildRequest({
        metadata: { workflow: 'edit' },
        inputs: { attachments: [], options: { maxPatchBytes: 500 } },
      })
    );

    const proposalEvent = events.find((event) => event.type === 'edit-proposal');
    expect(proposalEvent?.type).toBe('edit-proposal');
    if (proposalEvent?.type === 'edit-proposal') {
      expect(proposalEvent.proposal.proposal.patch).toBe(patch);
      expect(proposalEvent.proposal.proposal.summary.filesChanged).toBe(1);
    }
  });

  it('fails when allowWrites is false but writes are returned', async () => {
    const modelText = JSON.stringify({
      summary: 'Attempted write',
      proposal: {
        writes: [{ path: 'src/helpers/bar.ts', content: 'export const bar = 1;\n' }],
        summary: { filesChanged: 1 },
      },
    });
    const events: AgentEvent[] = [];
    const runner = new EditWorkflowRunner({
      toolExecutor: createToolExecutor(modelText),
      onEvent: (event) => events.push(event),
    });

    const runId = randomUUID();
    await expect(
      runner.startRun(
        runId,
        buildRequest({
          metadata: { workflow: 'edit' },
          inputs: { attachments: [], options: { allowWrites: false } },
        })
      )
    ).rejects.toThrow('allowWrites is false');

    const statusEvents = events.filter((event) => event.type === 'status');
    expect(statusEvents[0]).toMatchObject({ status: 'running' });
    expect(statusEvents[statusEvents.length - 1]).toMatchObject({ status: 'failed' });
  });
});
