import { describe, expect, it } from 'vitest';
import type { AgentSkillDescriptor } from 'packages-api-contracts';
import {
  DEFAULT_DELEGATION_MAX_COUNT,
  DEFAULT_DELEGATION_MAX_DEPTH,
  resolveSkillDelegation,
} from './agent-skill-delegation';

const buildSkill = (
  id: string,
  overrides?: Partial<AgentSkillDescriptor['definition']> & { enabled?: boolean }
): AgentSkillDescriptor => {
  const { enabled, ...definitionOverrides } = overrides ?? {};
  return {
    definition: {
      id,
      name: id,
      ...definitionOverrides,
    },
    source: 'user',
    scope: 'global',
    enabled: enabled ?? true,
  };
};

describe('resolveSkillDelegation', () => {
  it('resolves subagent tool policy with deny precedence and no widening', () => {
    const supervisor = buildSkill('skill.orchestrator', {
      toolAllowlist: ['repo.search', 'workspace.read', 'workspace.write'],
      toolDenylist: ['workspace.write'],
      delegation: {
        enabled: true,
        subagents: [
          {
            name: 'reviewer',
            description: 'Review specialist',
            skillId: 'skill.reviewer',
            toolAllowlist: ['workspace.read', 'workspace.write'],
            toolDenylist: ['repo.search'],
          },
        ],
      },
    });
    const reviewer = buildSkill('skill.reviewer', {
      toolAllowlist: ['workspace.read', 'repo.search'],
      toolDenylist: ['workspace.update'],
    });

    const resolved = resolveSkillDelegation({
      supervisor,
      availableSkills: [supervisor, reviewer],
    });

    expect(resolved).toEqual({
      enabled: true,
      maxDepth: DEFAULT_DELEGATION_MAX_DEPTH,
      maxDelegations: DEFAULT_DELEGATION_MAX_COUNT,
      subagents: [
        {
          name: 'reviewer',
          description: 'Review specialist',
          skillId: 'skill.reviewer',
          toolAllowlist: ['workspace.read'],
          toolDenylist: [
            'workspace.write',
            'workspace.update',
            'repo.search',
          ],
        },
      ],
    });
  });

  it('throws when a referenced delegation skill is missing', () => {
    const supervisor = buildSkill('skill.orchestrator', {
      delegation: {
        enabled: true,
        subagents: [
          {
            name: 'missing',
            description: 'Missing specialist',
            skillId: 'skill.missing',
          },
        ],
      },
    });

    expect(() =>
      resolveSkillDelegation({
        supervisor,
        availableSkills: [supervisor],
      })
    ).toThrow('Delegation skill not found: skill.missing');
  });

  it('throws when a referenced delegation skill is disabled', () => {
    const supervisor = buildSkill('skill.orchestrator', {
      delegation: {
        enabled: true,
        subagents: [
          {
            name: 'disabled',
            description: 'Disabled specialist',
            skillId: 'skill.disabled',
          },
        ],
      },
    });
    const disabled = buildSkill('skill.disabled', { enabled: false });

    expect(() =>
      resolveSkillDelegation({
        supervisor,
        availableSkills: [supervisor, disabled],
      })
    ).toThrow('Delegation skill is disabled: skill.disabled');
  });

  it('throws on delegation cycles', () => {
    const supervisor = buildSkill('skill.a', {
      delegation: {
        enabled: true,
        maxDepth: 3,
        maxDelegations: 6,
        subagents: [
          {
            name: 'b',
            description: 'Skill b',
            skillId: 'skill.b',
          },
        ],
      },
    });
    const nested = buildSkill('skill.b', {
      delegation: {
        enabled: true,
        subagents: [
          {
            name: 'a',
            description: 'Skill a',
            skillId: 'skill.a',
          },
        ],
      },
    });

    expect(() =>
      resolveSkillDelegation({
        supervisor,
        availableSkills: [supervisor, nested],
      })
    ).toThrow('Delegation cycle detected: skill.a -> skill.b -> skill.a');
  });

  it('throws when delegation depth exceeds maxDepth', () => {
    const supervisor = buildSkill('skill.supervisor', {
      delegation: {
        enabled: true,
        maxDepth: 1,
        subagents: [
          {
            name: 'reviewer',
            description: 'Reviewer',
            skillId: 'skill.reviewer',
          },
        ],
      },
    });
    const reviewer = buildSkill('skill.reviewer', {
      delegation: {
        enabled: true,
        subagents: [
          {
            name: 'deep',
            description: 'Deep specialist',
            skillId: 'skill.deep',
          },
        ],
      },
    });
    const deep = buildSkill('skill.deep');

    expect(() =>
      resolveSkillDelegation({
        supervisor,
        availableSkills: [supervisor, reviewer, deep],
      })
    ).toThrow('Delegation maxDepth exceeded');
  });

  it('throws when delegation edges exceed maxDelegations', () => {
    const supervisor = buildSkill('skill.supervisor', {
      delegation: {
        enabled: true,
        maxDelegations: 1,
        subagents: [
          {
            name: 'one',
            description: 'One',
            skillId: 'skill.one',
          },
          {
            name: 'two',
            description: 'Two',
            skillId: 'skill.two',
          },
        ],
      },
    });

    expect(() =>
      resolveSkillDelegation({
        supervisor,
        availableSkills: [
          supervisor,
          buildSkill('skill.one'),
          buildSkill('skill.two'),
        ],
      })
    ).toThrow('Delegation maxDelegations exceeded');
  });
});
