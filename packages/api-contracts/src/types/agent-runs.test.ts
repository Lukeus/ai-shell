import { describe, it, expect } from 'vitest';
import { AgentRunMetadataSchema, AgentRunStartRequestSchema } from './agent-runs';

describe('Agent run contracts', () => {
  it('accepts start requests with or without connectionId', () => {
    const baseRequest = { goal: 'Ship agent run' };
    expect(AgentRunStartRequestSchema.parse(baseRequest)).toEqual(baseRequest);

    const requestWithConnection = {
      goal: 'Run with connection',
      connectionId: '11111111-1111-4111-8111-111111111111',
    };
    expect(AgentRunStartRequestSchema.parse(requestWithConnection)).toEqual(
      requestWithConnection
    );

    const requestWithSkill = {
      goal: 'Run with skill',
      skillId: 'skill.writer',
    };
    expect(AgentRunStartRequestSchema.parse(requestWithSkill)).toEqual(
      requestWithSkill
    );

    const requestWithDelegation = {
      goal: 'Run with delegation',
      config: {
        delegation: {
          enabled: true,
          maxDepth: 2,
          maxDelegations: 4,
          subagents: [
            {
              name: 'reviewer',
              description: 'Review proposed changes.',
              skillId: 'skill.reviewer',
            },
          ],
        },
      },
    };
    expect(AgentRunStartRequestSchema.parse(requestWithDelegation)).toEqual(
      requestWithDelegation
    );
  });

  it('rejects start requests with non-uuid connectionId', () => {
    const badRequest = {
      goal: 'Invalid connection',
      connectionId: 'not-a-uuid',
    };
    expect(() => AgentRunStartRequestSchema.parse(badRequest)).toThrow();
  });

  it('accepts run metadata with optional routing', () => {
    const now = new Date().toISOString();
    const baseMetadata = {
      id: '22222222-2222-4222-8222-222222222222',
      status: 'queued',
      source: 'user',
      createdAt: now,
      updatedAt: now,
    };
    expect(AgentRunMetadataSchema.parse(baseMetadata)).toEqual(baseMetadata);

    const withRouting = {
      ...baseMetadata,
      routing: {
        connectionId: '33333333-3333-4333-8333-333333333333',
        providerId: 'ollama',
        modelRef: 'llama3',
      },
    };
    expect(AgentRunMetadataSchema.parse(withRouting)).toEqual(withRouting);

    const withSkill = {
      ...baseMetadata,
      skill: {
        skillId: 'skill.writer',
        source: 'user',
        scope: 'workspace',
        version: 1,
      },
    };
    expect(AgentRunMetadataSchema.parse(withSkill)).toEqual(withSkill);

    const withDelegation = {
      ...baseMetadata,
      delegation: {
        enabled: true,
        maxDepth: 2,
        maxDelegations: 4,
        subagentSkillIds: ['skill.reviewer', 'skill.implementer'],
      },
    };
    expect(AgentRunMetadataSchema.parse(withDelegation)).toEqual(withDelegation);
  });

  it('rejects invalid delegation config values', () => {
    const invalid = {
      goal: 'Run with invalid delegation',
      config: {
        delegation: {
          enabled: true,
          maxDepth: 0,
          subagents: [
            {
              name: 'reviewer',
              description: 'Review proposed changes.',
              skillId: 'skill.reviewer',
            },
          ],
        },
      },
    };

    expect(() => AgentRunStartRequestSchema.parse(invalid)).toThrow();
  });
});
