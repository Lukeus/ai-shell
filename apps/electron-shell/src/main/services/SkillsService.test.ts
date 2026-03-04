import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SkillsService } from './SkillsService';
import { workspaceService } from './WorkspaceService';
import { getExtensionRegistry } from '../index';

const mockUserDataPath = vi.hoisted(() => 'C:\\mock\\userdata');
const mockWorkspacePath = vi.hoisted(() => 'C:\\mock\\workspace');
const globalSkillsPath = path.join(mockUserDataPath, 'skills.json');
const workspaceSkillsPath = path.join(
  mockWorkspacePath,
  '.ai-shell',
  'skills.json'
);

let fileMap: Record<string, string> = {};

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('./WorkspaceService', () => ({
  workspaceService: {
    getWorkspace: vi.fn(),
    hasWorkspace: vi.fn(),
  },
}));

vi.mock('../index', () => ({
  getExtensionRegistry: vi.fn(() => null),
}));

const buildStore = (overrides?: Partial<Record<string, unknown>>) => ({
  version: 1,
  skills: {},
  disabled: {},
  preferences: { defaultSkillId: null, lastUsedSkillId: null },
  ...overrides,
});

describe('SkillsService', () => {
  let service: SkillsService;

  beforeEach(() => {
    vi.clearAllMocks();
    fileMap = {};

    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      const key = String(filePath);
      if (!(key in fileMap)) {
        const error = new Error('ENOENT: no such file or directory');
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }
      return fileMap[key];
    });

    vi.mocked(fs.writeFileSync).mockImplementation((filePath, content) => {
      fileMap[String(filePath)] = String(content);
    });

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

    vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
    vi.mocked(workspaceService.hasWorkspace).mockReturnValue(false);
    vi.mocked(getExtensionRegistry).mockReturnValue(null);

    // @ts-expect-error reset singleton for tests
    SkillsService.instance = null;
    service = SkillsService.getInstance();
  });

  it('lists extension and user skills with metadata', () => {
    vi.mocked(getExtensionRegistry).mockReturnValue({
      getEnabledExtensions: () => [
        {
          manifest: {
            id: 'ext.alpha',
            version: '1.0.0',
            contributes: {
              agentSkills: [{ id: 'ext-skill', name: 'Ext Skill' }],
            },
          },
          extensionPath: 'C:\\exts\\alpha',
          installedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          enabled: true,
        },
      ],
    } as any);

    fileMap[globalSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'user-skill': {
            definition: { id: 'user-skill', name: 'User Skill' },
            enabled: true,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const result = service.listSkills();
    const byId = new Map(
      result.skills.map((skill) => [skill.definition.id, skill])
    );

    expect(byId.get('ext-skill')?.source).toBe('extension');
    expect(byId.get('ext-skill')?.scope).toBe('global');
    expect(byId.get('user-skill')?.source).toBe('user');
    expect(byId.get('user-skill')?.enabled).toBe(true);
  });

  it('workspace skills override global skills with same id', () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: mockWorkspacePath,
      name: 'workspace',
    });
    vi.mocked(workspaceService.hasWorkspace).mockReturnValue(true);

    fileMap[globalSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'skill-a': {
            definition: { id: 'skill-a', name: 'Global Skill' },
            enabled: true,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    fileMap[workspaceSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'skill-a': {
            definition: { id: 'skill-a', name: 'Workspace Skill' },
            enabled: true,
            version: 1,
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        },
      })
    );

    const result = service.listSkills();
    const skill = result.skills.find((item) => item.definition.id === 'skill-a');
    expect(skill?.definition.name).toBe('Workspace Skill');
    expect(skill?.scope).toBe('workspace');
  });

  it('workspace disable overrides global skill availability', () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: mockWorkspacePath,
      name: 'workspace',
    });
    vi.mocked(workspaceService.hasWorkspace).mockReturnValue(true);

    vi.mocked(getExtensionRegistry).mockReturnValue({
      getEnabledExtensions: () => [
        {
          manifest: {
            id: 'ext.beta',
            version: '1.0.0',
            contributes: {
              agentSkills: [{ id: 'ext-skill', name: 'Ext Skill' }],
            },
          },
          extensionPath: 'C:\\exts\\beta',
          installedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          enabled: true,
        },
      ],
    } as any);

    fileMap[workspaceSkillsPath] = JSON.stringify(
      buildStore({
        disabled: { 'ext-skill': true },
      })
    );

    const result = service.listSkills();
    const skill = result.skills.find((item) => item.definition.id === 'ext-skill');
    expect(skill?.enabled).toBe(false);
    expect(skill?.scope).toBe('workspace');
  });

  it('creates and updates user skills', () => {
    const created = service.createSkill({
      scope: 'global',
      skill: { id: 'user-skill', name: 'User Skill' },
    });

    expect(created.skill.source).toBe('user');
    expect(created.skill.version).toBe(1);

    const updated = service.updateSkill({
      scope: 'global',
      id: 'user-skill',
      updates: { name: 'Updated Skill' },
    });

    expect(updated.skill.definition.name).toBe('Updated Skill');
    expect(updated.skill.version).toBe(2);

    const deleted = service.deleteSkill({
      scope: 'global',
      id: 'user-skill',
    });
    expect(deleted.success).toBe(true);
  });

  it('persists default and last used preferences', () => {
    service.createSkill({
      scope: 'global',
      skill: { id: 'pref-skill', name: 'Pref Skill' },
    });

    const defaultResult = service.setDefaultSkill({
      scope: 'global',
      skillId: 'pref-skill',
    });
    expect(defaultResult.preferences.defaultSkillId).toBe('pref-skill');

    const lastUsedResult = service.setLastUsedSkill({
      scope: 'global',
      skillId: 'pref-skill',
    });
    expect(lastUsedResult.preferences.lastUsedSkillId).toBe('pref-skill');
  });

  it('resolves last-used preference with global fallback for workspace scope', () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: mockWorkspacePath,
      name: 'workspace',
    });
    vi.mocked(workspaceService.hasWorkspace).mockReturnValue(true);

    fileMap[globalSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'global-skill': {
            definition: { id: 'global-skill', name: 'Global Skill' },
            enabled: true,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
        preferences: {
          defaultSkillId: null,
          lastUsedSkillId: 'global-skill',
        },
      })
    );
    fileMap[workspaceSkillsPath] = JSON.stringify(buildStore());

    const resolved = service.resolveSkillForRun();
    expect(resolved?.scope).toBe('workspace');
    expect(resolved?.resolvedBy).toBe('last-used');
    expect(resolved?.skill.definition.id).toBe('global-skill');
  });

  it('returns effective workspace preferences with global fallback in list response', () => {
    service.createSkill({
      scope: 'global',
      skill: { id: 'fallback-skill', name: 'Fallback Skill' },
    });
    service.setDefaultSkill({
      scope: 'global',
      skillId: 'fallback-skill',
    });

    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: mockWorkspacePath,
      name: 'workspace',
    });
    vi.mocked(workspaceService.hasWorkspace).mockReturnValue(true);
    fileMap[workspaceSkillsPath] = JSON.stringify(buildStore());

    const result = service.listSkills({ scope: 'workspace' });
    expect(result.preferences?.defaultSkillId).toBe('fallback-skill');
  });

  it('throws actionable error when explicit skill is disabled', () => {
    fileMap[globalSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'disabled-skill': {
            definition: { id: 'disabled-skill', name: 'Disabled Skill' },
            enabled: false,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    expect(() => service.resolveSkillForRun('disabled-skill')).toThrow(
      'Skill is disabled: disabled-skill.'
    );
  });

  it('resolves delegation config for a selected orchestrator skill', () => {
    fileMap[globalSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'skill.reviewer': {
            definition: {
              id: 'skill.reviewer',
              name: 'Reviewer',
              toolAllowlist: ['workspace.read', 'repo.search'],
              toolDenylist: ['workspace.update'],
            },
            enabled: true,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          'skill.orchestrator': {
            definition: {
              id: 'skill.orchestrator',
              name: 'Orchestrator',
              toolAllowlist: ['workspace.read', 'workspace.write'],
              delegation: {
                enabled: true,
                maxDepth: 2,
                maxDelegations: 8,
                subagents: [
                  {
                    name: 'reviewer',
                    description: 'Reviews plans and diffs.',
                    skillId: 'skill.reviewer',
                    toolAllowlist: ['workspace.read', 'workspace.update'],
                  },
                ],
              },
            },
            enabled: true,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const resolved = service.resolveSkillForRun('skill.orchestrator');
    expect(resolved?.delegation).toEqual({
      enabled: true,
      maxDepth: 2,
      maxDelegations: 8,
      subagents: [
        {
          name: 'reviewer',
          description: 'Reviews plans and diffs.',
          skillId: 'skill.reviewer',
          toolAllowlist: ['workspace.read'],
          toolDenylist: ['workspace.update'],
        },
      ],
    });
  });

  it('fails run skill resolution when delegation references a missing skill', () => {
    fileMap[globalSkillsPath] = JSON.stringify(
      buildStore({
        skills: {
          'skill.orchestrator': {
            definition: {
              id: 'skill.orchestrator',
              name: 'Orchestrator',
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
            },
            enabled: true,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    expect(() => service.resolveSkillForRun('skill.orchestrator')).toThrow(
      'Delegation skill not found: skill.missing'
    );
  });
});
