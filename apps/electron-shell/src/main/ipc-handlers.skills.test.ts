import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from 'packages-api-contracts';
import { registerSkillsHandlers } from './ipc/skills';
import { skillsService } from './services/SkillsService';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('./services/SkillsService', () => ({
  skillsService: {
    listSkills: vi.fn(),
    getSkill: vi.fn(),
    createSkill: vi.fn(),
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
    setSkillEnabled: vi.fn(),
    setDefaultSkill: vi.fn(),
    setLastUsedSkill: vi.fn(),
  },
}));

describe('IPC Handlers - Skills', () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();

    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: (...args: any[]) => Promise<any>) => {
        handlers.set(channel, handler);
        return ipcMain;
      }
    );

    registerSkillsHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getHandler = (channel: string) => {
    const handler = handlers.get(channel);
    expect(handler).toBeDefined();
    return handler!;
  };

  it('registers SKILLS_LIST handler', () => {
    expect(handlers.has(IPC_CHANNELS.SKILLS_LIST)).toBe(true);
  });

  it('lists skills via SkillsService', async () => {
    const response = { skills: [] };
    vi.mocked(skillsService.listSkills).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_LIST);
    const result = await handler(null, undefined);

    expect(skillsService.listSkills).toHaveBeenCalledWith({});
    expect(result).toEqual(response);
  });

  it('gets skills via SkillsService', async () => {
    const response = {
      skill: {
        definition: { id: 'skill-1', name: 'Skill 1' },
        source: 'user' as const,
        scope: 'global' as const,
        enabled: true,
      },
    };
    vi.mocked(skillsService.getSkill).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_GET);
    const result = await handler(null, { id: 'skill-1' });

    expect(skillsService.getSkill).toHaveBeenCalledWith({ id: 'skill-1' });
    expect(result).toEqual(response);
  });

  it('creates skills via SkillsService', async () => {
    const response = {
      skill: {
        definition: { id: 'skill-1', name: 'Skill 1' },
        source: 'user' as const,
        scope: 'global' as const,
        enabled: true,
      },
    };
    vi.mocked(skillsService.createSkill).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_CREATE);
    const result = await handler(null, {
      scope: 'global',
      skill: { id: 'skill-1', name: 'Skill 1' },
    });

    expect(skillsService.createSkill).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it('updates skills via SkillsService', async () => {
    const response = {
      skill: {
        definition: { id: 'skill-1', name: 'Updated Skill' },
        source: 'user' as const,
        scope: 'global' as const,
        enabled: true,
      },
    };
    vi.mocked(skillsService.updateSkill).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_UPDATE);
    const result = await handler(null, {
      scope: 'global',
      id: 'skill-1',
      updates: { name: 'Updated Skill' },
    });

    expect(skillsService.updateSkill).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it('deletes skills via SkillsService', async () => {
    const response = { success: true };
    vi.mocked(skillsService.deleteSkill).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_DELETE);
    const result = await handler(null, { scope: 'global', id: 'skill-1' });

    expect(skillsService.deleteSkill).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it('toggles skill enabled state via SkillsService', async () => {
    const response = {
      skill: {
        definition: { id: 'skill-1', name: 'Skill 1' },
        source: 'user' as const,
        scope: 'global' as const,
        enabled: false,
      },
    };
    vi.mocked(skillsService.setSkillEnabled).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_SET_ENABLED);
    const result = await handler(null, {
      scope: 'global',
      id: 'skill-1',
      enabled: false,
    });

    expect(skillsService.setSkillEnabled).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it('sets default skill via SkillsService', async () => {
    const response = {
      preferences: { defaultSkillId: 'skill-1', lastUsedSkillId: null },
    };
    vi.mocked(skillsService.setDefaultSkill).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_SET_DEFAULT);
    const result = await handler(null, {
      scope: 'global',
      skillId: 'skill-1',
    });

    expect(skillsService.setDefaultSkill).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it('sets last used skill via SkillsService', async () => {
    const response = {
      preferences: { defaultSkillId: null, lastUsedSkillId: 'skill-2' },
    };
    vi.mocked(skillsService.setLastUsedSkill).mockReturnValue(response);

    const handler = getHandler(IPC_CHANNELS.SKILLS_SET_LAST_USED);
    const result = await handler(null, {
      scope: 'global',
      skillId: 'skill-2',
    });

    expect(skillsService.setLastUsedSkill).toHaveBeenCalled();
    expect(result).toEqual(response);
  });
});
