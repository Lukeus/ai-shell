import { describe, it, expect } from 'vitest';
import {
  AgentSkillDefinitionSchema,
  AgentSkillDescriptorSchema,
  SkillPreferencesSchema,
} from './agent-skills';

describe('Agent skill contracts', () => {
  it('accepts a valid skill definition', () => {
    const skill = {
      id: 'skill.writer',
      name: 'Writer',
      description: 'Drafts clean prose.',
      promptTemplate: 'Write in a clear, concise style.',
      toolAllowlist: ['repo.search'],
      toolDenylist: ['workspace.write'],
      inputSchema: {
        type: 'object',
        properties: {
          tone: { type: 'string' },
        },
      },
      tags: ['writing', 'draft'],
    };

    expect(AgentSkillDefinitionSchema.parse(skill)).toEqual(skill);
  });

  it('rejects invalid skill definitions', () => {
    const invalid = { id: '', name: '' };
    expect(() => AgentSkillDefinitionSchema.parse(invalid)).toThrow();
  });

  it('accepts delegation-enabled skill definitions', () => {
    const skill = {
      id: 'skill.orchestrator',
      name: 'Orchestrator',
      delegation: {
        enabled: true,
        maxDepth: 2,
        maxDelegations: 8,
        subagents: [
          {
            name: 'reviewer',
            description: 'Reviews plans and diffs.',
            skillId: 'skill.reviewer',
            toolAllowlist: ['repo.search', 'workspace.read'],
          },
        ],
      },
    };

    expect(AgentSkillDefinitionSchema.parse(skill)).toEqual(skill);
  });

  it('rejects delegation with invalid subagent references', () => {
    const skill = {
      id: 'skill.orchestrator',
      name: 'Orchestrator',
      delegation: {
        enabled: true,
        subagents: [
          {
            name: 'reviewer',
            description: 'Reviews plans and diffs.',
            skillId: '',
          },
        ],
      },
    };

    expect(() => AgentSkillDefinitionSchema.parse(skill)).toThrow();
  });

  it('accepts skill descriptors with metadata', () => {
    const descriptor = {
      definition: {
        id: 'skill.reviewer',
        name: 'Reviewer',
      },
      source: 'extension',
      scope: 'global',
      enabled: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      extensionId: 'acme.skill-pack',
    };

    expect(AgentSkillDescriptorSchema.parse(descriptor)).toEqual(descriptor);
  });

  it('accepts skill preferences with null defaults', () => {
    const prefs = {
      defaultSkillId: null,
      lastUsedSkillId: null,
    };

    expect(SkillPreferencesSchema.parse(prefs)).toEqual(prefs);
  });
});
