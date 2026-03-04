import { describe, expect, it } from 'vitest';
import { AgentEventSchema } from './agent-events';

describe('Agent event contracts', () => {
  it('accepts tool-call events with delegation lineage', () => {
    const event = {
      id: '11111111-1111-4111-8111-111111111111',
      runId: '22222222-2222-4222-8222-222222222222',
      timestamp: new Date().toISOString(),
      type: 'tool-call',
      toolCall: {
        callId: '33333333-3333-4333-8333-333333333333',
        toolId: 'workspace.read',
        requesterId: 'agent-host',
        runId: '22222222-2222-4222-8222-222222222222',
        input: { path: 'README.md' },
        delegation: {
          agentRole: 'subagent',
          delegationId: 'delegation-1',
          supervisorSkillId: 'skill.orchestrator',
          subagentName: 'reviewer',
          subagentSkillId: 'skill.reviewer',
          depth: 1,
        },
      },
    };

    expect(AgentEventSchema.parse(event)).toEqual(event);
  });

  it('accepts delegation lifecycle events', () => {
    const runId = '22222222-2222-4222-8222-222222222222';
    const timestamp = new Date().toISOString();

    const started = {
      id: '33333333-3333-4333-8333-333333333333',
      runId,
      timestamp,
      type: 'delegation-started',
      delegationId: 'delegation-1',
      subagentName: 'reviewer',
      subagentSkillId: 'skill.reviewer',
      depth: 1,
    };
    expect(AgentEventSchema.parse(started)).toEqual(started);

    const completed = {
      id: '44444444-4444-4444-8444-444444444444',
      runId,
      timestamp,
      type: 'delegation-completed',
      delegationId: 'delegation-1',
      subagentName: 'reviewer',
      subagentSkillId: 'skill.reviewer',
      depth: 1,
      durationMs: 120,
    };
    expect(AgentEventSchema.parse(completed)).toEqual(completed);

    const failed = {
      id: '55555555-5555-4555-8555-555555555555',
      runId,
      timestamp,
      type: 'delegation-failed',
      delegationId: 'delegation-2',
      subagentName: 'implementer',
      subagentSkillId: 'skill.implementer',
      depth: 2,
      message: 'Delegation budget exceeded.',
      code: 'DELEGATION_BUDGET_EXCEEDED',
    };
    expect(AgentEventSchema.parse(failed)).toEqual(failed);
  });

  it('rejects invalid delegation event payloads', () => {
    const invalid = {
      id: '66666666-6666-4666-8666-666666666666',
      runId: '77777777-7777-4777-8777-777777777777',
      timestamp: new Date().toISOString(),
      type: 'delegation-started',
      delegationId: '',
      subagentName: 'reviewer',
      subagentSkillId: 'skill.reviewer',
      depth: -1,
    };

    expect(() => AgentEventSchema.parse(invalid)).toThrow();
  });
});
