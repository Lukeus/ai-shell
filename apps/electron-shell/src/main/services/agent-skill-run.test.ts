import { describe, expect, it } from 'vitest';
import type {
  AgentRunDelegationConfig,
  AgentRunStartRequest,
  AgentSkillDescriptor,
} from 'packages-api-contracts';
import {
  applySkillToRunRequest,
  toRunDelegationMetadata,
  toRunSkillMetadata,
} from './agent-skill-run';

const buildSkill = (
  overrides?: Partial<AgentSkillDescriptor['definition']>
): AgentSkillDescriptor => ({
  definition: {
    id: 'skill.orchestrator',
    name: 'Orchestrator',
    promptTemplate: 'Plan and execute safely.',
    ...overrides,
  },
  source: 'user',
  scope: 'global',
  enabled: true,
  version: 3,
});

describe('agent-skill-run', () => {
  it('applies skill prompt, policy, and delegation run bounds', () => {
    const request: AgentRunStartRequest = {
      goal: 'Complete the requested work',
      toolAllowlist: ['workspace.read', 'workspace.write'],
      config: {
        toolAllowlist: ['repo.search'],
        policy: {
          allowlist: ['workspace.read', 'repo.search'],
          denylist: ['repo.search'],
        },
      },
    };

    const delegation: AgentRunDelegationConfig = {
      enabled: true,
      maxDepth: 2,
      maxDelegations: 6,
      subagents: [
        {
          name: 'implementer',
          description: 'Implements focused changes.',
          skillId: 'skill.implementer',
          toolAllowlist: ['workspace.read', 'workspace.write'],
          toolDenylist: ['workspace.update'],
        },
      ],
    };

    const result = applySkillToRunRequest(
      request,
      buildSkill({
        toolDenylist: ['workspace.update'],
      }),
      delegation
    );

    expect(result.goal).toContain('Plan and execute safely.');
    expect(result.skillId).toBe('skill.orchestrator');
    expect(result.toolAllowlist).toEqual(['workspace.read', 'workspace.write']);
    expect(result.config?.toolAllowlist).toBeUndefined();
    expect(result.config?.policy).toEqual({
      allowlist: ['workspace.read'],
      denylist: ['workspace.update', 'repo.search'],
    });
    expect(result.config?.delegation).toEqual({
      enabled: true,
      maxDepth: 2,
      maxDelegations: 6,
      subagents: [
        {
          name: 'implementer',
          description: 'Implements focused changes.',
          skillId: 'skill.implementer',
          toolAllowlist: ['workspace.read'],
          toolDenylist: ['workspace.update', 'repo.search'],
        },
      ],
    });
  });

  it('preserves empty allowlists when all explicitly allowed tools are denied', () => {
    const request: AgentRunStartRequest = {
      goal: 'Do the thing',
      toolAllowlist: ['repo.search'],
    };

    const result = applySkillToRunRequest(
      request,
      buildSkill({
        toolDenylist: ['repo.search'],
      })
    );

    expect(result.toolAllowlist).toEqual([]);
  });

  it('clears untrusted request delegation when no resolved delegation is provided', () => {
    const request: AgentRunStartRequest = {
      goal: 'Do the thing',
      config: {
        delegation: {
          enabled: true,
          subagents: [
            {
              name: 'unsafe',
              description: 'Unsafe',
              skillId: 'skill.unsafe',
            },
          ],
        },
      },
    };

    const result = applySkillToRunRequest(request, buildSkill());
    expect(result.config?.delegation).toBeUndefined();
  });

  it('builds run skill metadata', () => {
    expect(toRunSkillMetadata(buildSkill())).toEqual({
      skillId: 'skill.orchestrator',
      source: 'user',
      scope: 'global',
      version: 3,
    });
  });

  it('builds run delegation metadata summary', () => {
    expect(
      toRunDelegationMetadata({
        enabled: true,
        maxDepth: 2,
        maxDelegations: 8,
        subagents: [
          {
            name: 'reviewer',
            description: 'Reviews plans.',
            skillId: 'skill.reviewer',
          },
          {
            name: 'reviewer-2',
            description: 'Reviews plans.',
            skillId: 'skill.reviewer',
          },
          {
            name: 'implementer',
            description: 'Implements changes.',
            skillId: 'skill.implementer',
          },
        ],
      })
    ).toEqual({
      enabled: true,
      maxDepth: 2,
      maxDelegations: 8,
      subagentSkillIds: ['skill.reviewer', 'skill.implementer'],
    });
  });
});
