import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerAgentHandlers } from './agents';
import { agentRunStore } from '../services/AgentRunStore';
import { connectionsService } from '../services/ConnectionsService';
import { skillsService } from '../services/SkillsService';
import { settingsService } from '../services/SettingsService';
import { getAgentHostManager } from '../index';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

vi.mock('../services/AgentRunStore', () => ({
  agentRunStore: {
    createRun: vi.fn(),
    updateRunStatus: vi.fn(),
    updateRunRouting: vi.fn(),
    updateRunSkill: vi.fn(),
    updateRunDelegation: vi.fn(),
    appendEvent: vi.fn(),
  },
}));

vi.mock('../services/ConnectionsService', () => ({
  connectionsService: {
    listConnections: vi.fn(),
  },
}));

vi.mock('../services/SkillsService', () => ({
  skillsService: {
    getActiveScope: vi.fn(),
    resolveSkillForRun: vi.fn(),
    setLastUsedSkill: vi.fn(),
  },
}));

vi.mock('../services/SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
  },
}));

vi.mock('../index', () => ({
  getAgentHostManager: vi.fn(() => null),
}));

describe('IPC Agents handlers (Task 4)', () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();

    vi.mocked(settingsService.getSettings).mockReturnValue(SETTINGS_DEFAULTS);
    vi.mocked(skillsService.getActiveScope).mockReturnValue('global');
    vi.mocked(skillsService.resolveSkillForRun).mockReturnValue(null);
    vi.mocked(skillsService.setLastUsedSkill).mockReturnValue({
      preferences: { defaultSkillId: null, lastUsedSkillId: null },
    });

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, handler);
      return ipcMain;
    });

    registerAgentHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getHandler = (channel: string): ((...args: any[]) => Promise<any>) => {
    const handler = handlers.get(channel);
    expect(handler).toBeDefined();
    return handler!;
  };

  it('persists delegation summary metadata and forwards resolved delegation to agent-host', async () => {
    const connectionId = '123e4567-e89b-12d3-a456-426614174411';
    const run = {
      id: '123e4567-e89b-12d3-a456-426614174410',
      status: 'queued' as const,
      source: 'user' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const runWithSkill = {
      ...run,
      skill: {
        skillId: 'skill.orchestrator',
        source: 'user' as const,
        scope: 'global' as const,
        version: 1,
      },
    };
    const runWithDelegation = {
      ...runWithSkill,
      delegation: {
        enabled: true,
        maxDepth: 2,
        maxDelegations: 8,
        subagentSkillIds: ['skill.reviewer', 'skill.implementer'],
      },
    };
    const routedRun = {
      ...runWithDelegation,
      routing: {
        connectionId,
        providerId: 'ollama',
        modelRef: 'llama3',
      },
    };

    vi.mocked(agentRunStore.createRun).mockReturnValue(run);
    vi.mocked(agentRunStore.updateRunSkill).mockReturnValue(runWithSkill);
    vi.mocked(agentRunStore.updateRunDelegation).mockReturnValue(runWithDelegation);
    vi.mocked(agentRunStore.updateRunRouting).mockReturnValue(routedRun);
    vi.mocked(connectionsService.listConnections).mockReturnValue([
      {
        metadata: {
          id: connectionId,
          providerId: 'ollama',
        },
        config: {
          model: 'llama3',
        },
      } as any,
    ]);

    const agentHostManager = {
      startRun: vi.fn().mockResolvedValue(undefined),
      onEvent: vi.fn(() => () => undefined),
      onRunError: vi.fn(() => () => undefined),
    };
    vi.mocked(getAgentHostManager)
      .mockImplementationOnce(() => null)
      .mockImplementation(
        () => agentHostManager as unknown as ReturnType<typeof getAgentHostManager>
      );

    vi.mocked(skillsService.resolveSkillForRun).mockReturnValue({
      skill: {
        definition: {
          id: 'skill.orchestrator',
          name: 'Orchestrator',
          promptTemplate: 'Delegate specialist tasks.',
        },
        source: 'user',
        scope: 'global',
        enabled: true,
        version: 1,
      },
      resolvedBy: 'explicit',
      scope: 'global',
      delegation: {
        enabled: true,
        maxDepth: 2,
        maxDelegations: 8,
        subagents: [
          {
            name: 'reviewer',
            description: 'Review specialist',
            skillId: 'skill.reviewer',
            toolAllowlist: ['workspace.read'],
          },
          {
            name: 'implementer',
            description: 'Implementation specialist',
            skillId: 'skill.implementer',
            toolAllowlist: ['workspace.read', 'workspace.write'],
          },
        ],
      },
    });

    const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_START);
    const result = await handler(null, {
      goal: 'Ship a safe fix',
      connectionId,
      skillId: 'skill.orchestrator',
    });

    expect(agentRunStore.updateRunDelegation).toHaveBeenCalledWith(run.id, {
      enabled: true,
      maxDepth: 2,
      maxDelegations: 8,
      subagentSkillIds: ['skill.reviewer', 'skill.implementer'],
    });
    expect(agentHostManager.startRun).toHaveBeenCalledWith(
      run.id,
      expect.objectContaining({
        config: expect.objectContaining({
          delegation: expect.objectContaining({
            enabled: true,
            maxDepth: 2,
            maxDelegations: 8,
          }),
        }),
      })
    );
    expect(result).toEqual({ run: routedRun });
  });

  it('surfaces actionable delegation validation failures before run execution', async () => {
    const run = {
      id: '123e4567-e89b-12d3-a456-426614174500',
      status: 'queued' as const,
      source: 'user' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const failedRun = { ...run, status: 'failed' as const };

    vi.mocked(agentRunStore.createRun).mockReturnValue(run);
    vi.mocked(agentRunStore.updateRunStatus).mockReturnValue(failedRun);
    vi.mocked(skillsService.resolveSkillForRun).mockImplementation(() => {
      throw new Error(
        'Delegation skill not found: skill.reviewer (referenced by skill.orchestrator).'
      );
    });

    const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_START);
    const result = await handler(null, {
      goal: 'Ship a safe fix',
      skillId: 'skill.orchestrator',
    });

    expect(agentRunStore.updateRunStatus).toHaveBeenCalledWith(run.id, 'failed');
    expect(agentRunStore.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('Delegation skill not found: skill.reviewer'),
      })
    );
    expect(result).toEqual({ run: failedRun });
  });
});
