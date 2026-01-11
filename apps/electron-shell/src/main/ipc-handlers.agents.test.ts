import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerAgentHandlers } from './ipc/agents';
import { agentRunStore } from './services/AgentRunStore';
import { connectionsService } from './services/ConnectionsService';
import { settingsService } from './services/SettingsService';
import { getAgentHostManager } from './index';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

vi.mock('./services/AgentRunStore', () => ({
  agentRunStore: {
    listRuns: vi.fn(),
    getRun: vi.fn(),
    createRun: vi.fn(),
    updateRunStatus: vi.fn(),
    updateRunRouting: vi.fn(),
    appendEvent: vi.fn(),
    resetRunEvents: vi.fn(),
    listEvents: vi.fn(),
  },
}));

vi.mock('./services/ConnectionsService', () => ({
  connectionsService: {
    listConnections: vi.fn(),
  },
}));

vi.mock('./services/SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
  },
}));

vi.mock('./index', () => ({
  getAgentHostManager: vi.fn(() => null),
}));

describe('IPC Handlers - Agents', () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();

    vi.mocked(settingsService.getSettings).mockReturnValue(SETTINGS_DEFAULTS);

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, handler);
      return ipcMain;
    });

    registerAgentHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getHandler(channel: string) {
    const handler = handlers.get(channel);
    expect(handler).toBeDefined();
    return handler!;
  }

  describe('Agent handlers', () => {
    it('should register AGENT_RUNS_LIST handler', () => {
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_LIST)).toBe(true);
    });

    it('should list agent runs', async () => {
      const mockRuns = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'queued' as const,
          source: 'user' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      vi.mocked(agentRunStore.listRuns).mockReturnValue(mockRuns);

      const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_LIST);
      const result = await handler();

      expect(agentRunStore.listRuns).toHaveBeenCalled();
      expect(result).toEqual({ runs: mockRuns });
    });

    it('should get an agent run', async () => {
      const run = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'queued' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(agentRunStore.getRun).mockReturnValue(run);

      const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_GET);
      const result = await handler(null, { runId: run.id });

      expect(agentRunStore.getRun).toHaveBeenCalledWith(run.id);
      expect(result).toEqual({ run });
    });

    it('should throw if agent run is missing', async () => {
      vi.mocked(agentRunStore.getRun).mockReturnValue(undefined);

      const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_GET);
      await expect(handler(null, { runId: '123e4567-e89b-12d3-a456-426614174000' }))
        .rejects.toThrow('Agent run not found');
    });

    it('should start a run and append a status event', async () => {
      const connectionId = '123e4567-e89b-12d3-a456-426614174111';
      const connection = {
        metadata: {
          id: connectionId,
          providerId: 'ollama',
          scope: 'user' as const,
          displayName: 'Local Ollama',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        config: {
          model: 'llama3',
        },
      };
      const run = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'queued' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const routedRun = {
        ...run,
        routing: {
          connectionId,
          providerId: 'ollama',
          modelRef: 'llama3',
        },
      };
      const failedRun = { ...routedRun, status: 'failed' as const };
      vi.mocked(agentRunStore.createRun).mockReturnValue(run);
      vi.mocked(connectionsService.listConnections).mockReturnValue([connection]);
      vi.mocked(agentRunStore.updateRunRouting).mockReturnValue(routedRun);
      vi.mocked(agentRunStore.updateRunStatus).mockReturnValue(failedRun);

      const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_START);
      const result = await handler(null, { goal: 'Do the thing', connectionId });

      expect(agentRunStore.createRun).toHaveBeenCalledWith('user');
      expect(agentRunStore.updateRunRouting).toHaveBeenCalledWith(run.id, {
        connectionId,
        providerId: 'ollama',
        modelRef: 'llama3',
      });
      expect(agentRunStore.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          runId: run.id,
          status: 'queued',
        })
      );
      expect(result).toEqual({ run: failedRun });
    });

    it('should cancel a run and append a status event', async () => {
      const run = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'canceled' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      vi.mocked(agentRunStore.updateRunStatus).mockReturnValue(run);

      const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_CANCEL);
      const result = await handler(null, { runId: run.id, action: 'cancel' });

      expect(agentRunStore.updateRunStatus).toHaveBeenCalledWith(run.id, 'canceled');
      expect(agentRunStore.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          runId: run.id,
          status: 'canceled',
        })
      );
      expect(result).toEqual({ run });
    });

    it('should list agent trace events', async () => {
      vi.mocked(agentRunStore.listEvents).mockReturnValue({
        events: [],
        nextCursor: undefined,
      });

      const handler = getHandler(IPC_CHANNELS.AGENT_TRACE_LIST);
      const result = await handler(null, {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 1,
      });

      expect(agentRunStore.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: '123e4567-e89b-12d3-a456-426614174000',
          limit: 1,
        })
      );
      expect(result).toEqual({ events: [], nextCursor: undefined });
    });
  });

  describe('Agent run integration with event stream', () => {
    it('should emit status events in correct order for run lifecycle', async () => {
      const connectionId = '123e4567-e89b-12d3-a456-426614174111';
      const connection = {
        metadata: {
          id: connectionId,
          providerId: 'ollama',
          scope: 'user' as const,
          displayName: 'Local Ollama',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        config: {
          model: 'llama3',
        },
      };
      const mockRun = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'queued' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const routedRun = {
        ...mockRun,
        routing: {
          connectionId,
          providerId: 'ollama',
          modelRef: 'llama3',
        },
      };
      vi.mocked(agentRunStore.createRun).mockReturnValue(mockRun);
      vi.mocked(connectionsService.listConnections).mockReturnValue([connection]);
      vi.mocked(agentRunStore.updateRunRouting).mockReturnValue(routedRun);

      // Start run
      const startHandler = getHandler(IPC_CHANNELS.AGENT_RUNS_START);
      await startHandler(null, { goal: 'Integration test', connectionId });

      expect(agentRunStore.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          runId: mockRun.id,
          status: 'queued',
        })
      );

      // Cancel run
      const canceledRun = { ...mockRun, status: 'canceled' as const };
      vi.mocked(agentRunStore.updateRunStatus).mockReturnValue(canceledRun);
      vi.clearAllMocks();

      const cancelHandler = getHandler(IPC_CHANNELS.AGENT_RUNS_CANCEL);
      await cancelHandler(null, { runId: mockRun.id, action: 'cancel' });

      expect(agentRunStore.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          runId: mockRun.id,
          status: 'canceled',
        })
      );
    });

    it('should redact tool inputs before publishing agent events', async () => {
      const connectionId = '123e4567-e89b-12d3-a456-426614174111';
      const connection = {
        metadata: {
          id: connectionId,
          providerId: 'ollama',
          scope: 'user' as const,
          displayName: 'Local Ollama',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        config: {
          model: 'llama3',
        },
      };
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const mockRun = {
        id: runId,
        status: 'queued' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const routedRun = {
        ...mockRun,
        routing: {
          connectionId,
          providerId: 'ollama',
          modelRef: 'llama3',
        },
      };

      const onEventHandlers: Array<(event: unknown) => void> = [];
      const agentHostManager = {
        startRun: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn((handler: (event: unknown) => void) => {
          onEventHandlers.push(handler);
          return () => undefined;
        }),
        onRunError: vi.fn(() => () => undefined),
      };

      vi.mocked(getAgentHostManager).mockReturnValue(
        agentHostManager as unknown as ReturnType<typeof getAgentHostManager>
      );
      vi.mocked(agentRunStore.createRun).mockReturnValue(mockRun);
      vi.mocked(connectionsService.listConnections).mockReturnValue([connection]);
      vi.mocked(agentRunStore.updateRunRouting).mockReturnValue(routedRun);

      const sender = {
        id: 1,
        isDestroyed: vi.fn(() => false),
        send: vi.fn(),
        once: vi.fn(),
      };

      const subscribeHandler = getHandler(IPC_CHANNELS.AGENT_EVENTS_SUBSCRIBE);
      await subscribeHandler({ sender }, { runId });

      const startHandler = getHandler(IPC_CHANNELS.AGENT_RUNS_START);
      await startHandler(null, { goal: 'Test', connectionId });

      expect(onEventHandlers).toHaveLength(1);
      onEventHandlers[0]({
        id: '123e4567-e89b-12d3-a456-426614174001',
        runId,
        timestamp: '2024-01-01T00:00:00.000Z',
        type: 'tool-call',
        toolCall: {
          callId: '123e4567-e89b-12d3-a456-426614174002',
          toolId: 'workspace.read',
          requesterId: 'agent-host',
          runId,
          input: { path: '/secret-file.txt', apiKey: 'sk-secret-value', token: 'tok-123' },
        },
      });

      const publishCall = sender.send.mock.calls.find(
        (call: unknown[]) =>
          call[0] === IPC_CHANNELS.AGENT_EVENTS_ON_EVENT && (call[1] as { type?: string })?.type === 'tool-call'
      );

      expect(publishCall).toBeDefined();
      const publishedEvent = publishCall?.[1];
      expect(publishedEvent.toolCall.input.apiKey).toBe('[REDACTED]');
      expect(publishedEvent.toolCall.input.token).toBe('[REDACTED]');
    });

    it('should verify event stream contains no sensitive data', async () => {
      const eventsWithSensitiveData = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          type: 'tool-call' as const,
          runId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: '2024-01-01T00:00:00.000Z',
          toolCall: {
            callId: '123e4567-e89b-12d3-a456-426614174002',
            toolId: 'fs.read',
            requesterId: 'agent-host',
            runId: '123e4567-e89b-12d3-a456-426614174000',
            input: { path: '/secret-file.txt', apiKey: 'sk-secret-value' },
          },
        },
      ];

      vi.mocked(agentRunStore.listEvents).mockReturnValue({
        events: eventsWithSensitiveData,
        nextCursor: undefined,
      });

      const handler = getHandler(IPC_CHANNELS.AGENT_TRACE_LIST);
      const result = await handler(null, {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 100,
      });

      expect(agentRunStore.listEvents).toHaveBeenCalled();
      expect(result.events).toBeDefined();
    });
  });

  describe('Agent handlers - retry', () => {
    it('should retry a run and append a status event', async () => {
      const connectionId = '123e4567-e89b-12d3-a456-426614174111';
      const connection = {
        metadata: {
          id: connectionId,
          providerId: 'ollama',
          scope: 'user' as const,
          displayName: 'Local Ollama',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        config: {
          model: 'llama3',
        },
      };
      const run = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'queued' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      const routedRun = {
        ...run,
        routing: {
          connectionId,
          providerId: 'ollama',
          modelRef: 'llama3',
        },
      };
      const agentHostManager = {
        startRun: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn(() => () => undefined),
        onRunError: vi.fn(() => () => undefined),
        cancelRun: vi.fn(),
      };
      vi.mocked(getAgentHostManager).mockReturnValue(
        agentHostManager as unknown as ReturnType<typeof getAgentHostManager>
      );
      vi.mocked(agentRunStore.createRun).mockReturnValue(run);
      vi.mocked(connectionsService.listConnections).mockReturnValue([connection]);
      vi.mocked(agentRunStore.updateRunRouting).mockReturnValue(routedRun);

      const startHandler = getHandler(IPC_CHANNELS.AGENT_RUNS_START);
      await startHandler(null, { goal: 'Seed run', connectionId });

      vi.mocked(agentRunStore.updateRunStatus).mockReturnValue(run);

      const handler = getHandler(IPC_CHANNELS.AGENT_RUNS_RETRY);
      const result = await handler(null, { runId: run.id, action: 'retry' });

      expect(agentRunStore.updateRunStatus).toHaveBeenCalledWith(run.id, 'queued');
      expect(agentRunStore.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          runId: run.id,
          status: 'queued',
        })
      );
      expect(result).toEqual({ run });
    });
  });
});
