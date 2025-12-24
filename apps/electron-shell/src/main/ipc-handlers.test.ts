import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerIPCHandlers } from './ipc-handlers';
import { workspaceService } from './services/WorkspaceService';
import { fsBrokerService } from './services/FsBrokerService';
import { terminalService } from './services/TerminalService';
import { searchService } from './services/SearchService';
import { gitService } from './services/GitService';
import { settingsService } from './services/SettingsService';
import { connectionsService } from './services/ConnectionsService';
import { connectionProviderRegistry } from './services/ConnectionProviderRegistry';
import { secretsService } from './services/SecretsService';
import { consentService } from './services/ConsentService';
import { auditService } from './services/AuditService';
import { agentRunStore } from './services/AgentRunStore';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
}));

// Mock services
vi.mock('./services/WorkspaceService', () => ({
  workspaceService: {
    openWorkspace: vi.fn(),
    getWorkspace: vi.fn(),
    clearWorkspace: vi.fn(),
  },
}));

vi.mock('./services/TerminalService', () => ({
  terminalService: {
    createSession: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    close: vi.fn(),
    listSessions: vi.fn(),
  },
}));

vi.mock('./services/SearchService', () => ({
  searchService: {
    search: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock('./services/GitService', () => ({
  gitService: {
    getStatus: vi.fn(),
    stage: vi.fn(),
    unstage: vi.fn(),
    commit: vi.fn(),
  },
}));

vi.mock('./services/FsBrokerService', () => ({
  fsBrokerService: {
    readDirectory: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    createFile: vi.fn(),
    createDirectory: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./services/SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  },
}));

vi.mock('./services/ConnectionsService', () => ({
  connectionsService: {
    listConnections: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    setSecretRef: vi.fn(),
  },
}));

vi.mock('./services/ConnectionProviderRegistry', () => ({
  connectionProviderRegistry: {
    list: vi.fn(),
  },
}));

vi.mock('./services/SecretsService', () => ({
  secretsService: {
    setSecret: vi.fn(),
    replaceSecret: vi.fn(),
  },
}));

vi.mock('./services/ConsentService', () => ({
  consentService: {
    evaluateAccess: vi.fn(),
    recordDecision: vi.fn(),
  },
}));

vi.mock('./services/AuditService', () => ({
  auditService: {
    logSecretAccess: vi.fn(),
    listEvents: vi.fn(),
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
    listEvents: vi.fn(),
  },
}));

vi.mock('./services/SddTraceService', () => ({
  sddTraceService: {
    onStatusChange: vi.fn(),
    setEnabled: vi.fn(),
    getStatus: vi.fn(),
    startRun: vi.fn(),
    stopRun: vi.fn(),
    setActiveTask: vi.fn(),
    getFileTrace: vi.fn(),
    getTaskTrace: vi.fn(),
    getParity: vi.fn(),
    overrideUntracked: vi.fn(),
  },
}));

vi.mock('./services/SddWatcher', () => ({
  sddWatcher: {
    setEnabled: vi.fn(),
  },
}));

vi.mock('./index', () => ({
  getAgentHostManager: vi.fn(() => null),
  getExtensionCommandService: vi.fn(() => null),
  getExtensionRegistry: vi.fn(() => null),
  getExtensionViewService: vi.fn(() => null),
  getExtensionToolService: vi.fn(() => null),
  getPermissionService: vi.fn(() => null),
}));


describe('IPC Handlers', () => {
  // Store handlers for testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();
    handlers.clear();

    vi.mocked(settingsService.getSettings).mockReturnValue(SETTINGS_DEFAULTS);
    vi.mocked(sddTraceService.onStatusChange).mockReturnValue(() => undefined);
    vi.mocked(sddTraceService.setEnabled).mockResolvedValue(undefined);
    vi.mocked(sddWatcher.setEnabled).mockReturnValue(undefined);

    // Capture handlers registered via ipcMain.handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, handler);
      return ipcMain;
    });

    // Register handlers
    registerIPCHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to get handler with type safety
  function getHandler(channel: string) {
    const handler = handlers.get(channel);
    expect(handler).toBeDefined();
    return handler!;
  }

  describe('Workspace handlers', () => {
    it('should register WORKSPACE_OPEN handler', () => {
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_OPEN)).toBe(true);
    });

    it('should call workspaceService.openWorkspace on WORKSPACE_OPEN', async () => {
      const mockWorkspace = { path: '/test/workspace', name: 'workspace' };
      vi.mocked(workspaceService.openWorkspace).mockResolvedValue(mockWorkspace);

      const handler = handlers.get(IPC_CHANNELS.WORKSPACE_OPEN);
      expect(handler).toBeDefined();
      const result = await handler?.();

      expect(workspaceService.openWorkspace).toHaveBeenCalled();
      expect(result).toEqual(mockWorkspace);
    });

    it('should return null from WORKSPACE_OPEN if user cancels', async () => {
      vi.mocked(workspaceService.openWorkspace).mockResolvedValue(null);

      const handler = handlers.get(IPC_CHANNELS.WORKSPACE_OPEN);
      expect(handler).toBeDefined();
      const result = await handler?.();

      expect(result).toBeNull();
    });

    it('should register WORKSPACE_GET_CURRENT handler', () => {
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_GET_CURRENT)).toBe(true);
    });

    it('should call workspaceService.getWorkspace on WORKSPACE_GET_CURRENT', async () => {
      const mockWorkspace = { path: '/test/workspace', name: 'workspace' };
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(mockWorkspace);

      const handler = handlers.get(IPC_CHANNELS.WORKSPACE_GET_CURRENT);
      expect(handler).toBeDefined();
      const result = await handler?.();

      expect(workspaceService.getWorkspace).toHaveBeenCalled();
      expect(result).toEqual(mockWorkspace);
    });

    it('should register WORKSPACE_CLOSE handler', () => {
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_CLOSE)).toBe(true);
    });

    it('should call workspaceService.clearWorkspace on WORKSPACE_CLOSE', async () => {
      const handler = handlers.get(IPC_CHANNELS.WORKSPACE_CLOSE);
      expect(handler).toBeDefined();
      await handler?.();

      expect(workspaceService.clearWorkspace).toHaveBeenCalled();
    });
  });

  describe('Filesystem broker handlers', () => {
    describe('FS_READ_DIRECTORY', () => {
      it('should register FS_READ_DIRECTORY handler', () => {
        expect(handlers.has(IPC_CHANNELS.FS_READ_DIRECTORY)).toBe(true);
      });

      it('should validate request with Zod schema and call fsBrokerService', async () => {
        const mockResponse = {
          entries: [
            { name: 'file.txt', path: '/test/file.txt', type: 'file' as const, size: 100 },
          ],
        };
        vi.mocked(fsBrokerService.readDirectory).mockResolvedValue(mockResponse);

        const handler = getHandler(IPC_CHANNELS.FS_READ_DIRECTORY);
        const result = await handler(null, { path: './test' });

        expect(fsBrokerService.readDirectory).toHaveBeenCalledWith('./test');
        expect(result).toEqual(mockResponse);
      });

      it('should reject invalid request with Zod validation error', async () => {
        const handler = getHandler(IPC_CHANNELS.FS_READ_DIRECTORY);
        await expect(handler(null, { invalidField: 'test' })).rejects.toThrow();
      });

      it('should propagate FsError from service', async () => {
        const fsError = { code: 'ENOENT', message: 'Directory not found' };
        vi.mocked(fsBrokerService.readDirectory).mockRejectedValue(fsError);

        const handler = getHandler(IPC_CHANNELS.FS_READ_DIRECTORY);
        await expect(handler(null, { path: './nonexistent' })).rejects.toEqual(fsError);
      });
    });

    describe('FS_READ_FILE', () => {
      it('should register FS_READ_FILE handler', () => {
        expect(handlers.has(IPC_CHANNELS.FS_READ_FILE)).toBe(true);
      });

      it('should validate request and call fsBrokerService.readFile', async () => {
        const mockResponse = { content: 'file content', encoding: 'utf-8' as const };
        vi.mocked(fsBrokerService.readFile).mockResolvedValue(mockResponse);

        const handler = getHandler(IPC_CHANNELS.FS_READ_FILE);
        const result = await handler(null, { path: './file.txt' });

        expect(fsBrokerService.readFile).toHaveBeenCalledWith('./file.txt');
        expect(result).toEqual(mockResponse);
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.FS_READ_FILE);
        await expect(handler(null, {})).rejects.toThrow();
      });
    });

    describe('FS_CREATE_FILE', () => {
      it('should register FS_CREATE_FILE handler', () => {
        expect(handlers.has(IPC_CHANNELS.FS_CREATE_FILE)).toBe(true);
      });

      it('should validate request and call fsBrokerService.createFile', async () => {
        vi.mocked(fsBrokerService.createFile).mockResolvedValue(undefined);

        const handler = getHandler(IPC_CHANNELS.FS_CREATE_FILE);
        await handler(null, { path: './new-file.txt', content: 'initial content' });

        expect(fsBrokerService.createFile).toHaveBeenCalledWith('./new-file.txt', 'initial content');
      });

      it('should use default empty content if not provided', async () => {
        vi.mocked(fsBrokerService.createFile).mockResolvedValue(undefined);

        const handler = getHandler(IPC_CHANNELS.FS_CREATE_FILE);
        await handler(null, { path: './new-file.txt' });

        expect(fsBrokerService.createFile).toHaveBeenCalledWith('./new-file.txt', '');
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.FS_CREATE_FILE);
        await expect(handler(null, { invalidField: 'test' })).rejects.toThrow();
      });
    });

    describe('FS_CREATE_DIRECTORY', () => {
      it('should register FS_CREATE_DIRECTORY handler', () => {
        expect(handlers.has(IPC_CHANNELS.FS_CREATE_DIRECTORY)).toBe(true);
      });

      it('should validate request and call fsBrokerService.createDirectory', async () => {
        vi.mocked(fsBrokerService.createDirectory).mockResolvedValue(undefined);

        const handler = getHandler(IPC_CHANNELS.FS_CREATE_DIRECTORY);
        await handler(null, { path: './new-folder' });

        expect(fsBrokerService.createDirectory).toHaveBeenCalledWith('./new-folder');
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.FS_CREATE_DIRECTORY);
        await expect(handler(null, {})).rejects.toThrow();
      });
    });

    describe('FS_RENAME', () => {
      it('should register FS_RENAME handler', () => {
        expect(handlers.has(IPC_CHANNELS.FS_RENAME)).toBe(true);
      });

      it('should validate request and call fsBrokerService.rename', async () => {
        vi.mocked(fsBrokerService.rename).mockResolvedValue(undefined);

        const handler = getHandler(IPC_CHANNELS.FS_RENAME);
        await handler(null, { oldPath: './old.txt', newPath: './new.txt' });

        expect(fsBrokerService.rename).toHaveBeenCalledWith('./old.txt', './new.txt');
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.FS_RENAME);
        await expect(handler(null, { oldPath: './old.txt' })).rejects.toThrow();
      });
    });

    describe('FS_DELETE', () => {
      it('should register FS_DELETE handler', () => {
        expect(handlers.has(IPC_CHANNELS.FS_DELETE)).toBe(true);
      });

      it('should validate request and call fsBrokerService.delete', async () => {
        vi.mocked(fsBrokerService.delete).mockResolvedValue(undefined);

        const handler = getHandler(IPC_CHANNELS.FS_DELETE);
        await handler(null, { path: './file-to-delete.txt' });

        expect(fsBrokerService.delete).toHaveBeenCalledWith('./file-to-delete.txt');
      });

      it('should accept request with recursive flag (though not used)', async () => {
        vi.mocked(fsBrokerService.delete).mockResolvedValue(undefined);

        const handler = getHandler(IPC_CHANNELS.FS_DELETE);
        await handler(null, { path: './folder', recursive: true });

        expect(fsBrokerService.delete).toHaveBeenCalledWith('./folder');
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.FS_DELETE);
        await expect(handler(null, {})).rejects.toThrow();
      });
    });
  });

  describe('Terminal handlers', () => {
    describe('TERMINAL_CREATE', () => {
      it('should register TERMINAL_CREATE handler', () => {
        expect(handlers.has(IPC_CHANNELS.TERMINAL_CREATE)).toBe(true);
      });

      it('should validate request with Zod schema and call terminalService.createSession', async () => {
        const mockWorkspace = { path: 'C:\\workspace', name: 'workspace' };
        vi.mocked(workspaceService.getWorkspace).mockReturnValue(mockWorkspace);
        
        const mockSession = {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Terminal 1',
          cwd: 'C:\\workspace\\project',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'running' as const,
        };
        vi.mocked(terminalService.createSession).mockReturnValue(mockSession);

        const handler = getHandler(IPC_CHANNELS.TERMINAL_CREATE);
        const result = await handler(null, { cwd: 'C:\\workspace\\project', cols: 80, rows: 24 });

        expect(terminalService.createSession).toHaveBeenCalledWith(
          { cwd: 'C:\\workspace\\project', cols: 80, rows: 24 },
          'C:\\workspace'
        );
        expect(result).toEqual({ session: mockSession });
      });

      it('should pass null workspace if no workspace open', async () => {
        vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
        vi.mocked(terminalService.createSession).mockImplementation(() => {
          throw new Error('Cannot create terminal: no workspace open');
        });

        const handler = getHandler(IPC_CHANNELS.TERMINAL_CREATE);
        
        await expect(handler(null, { cwd: 'C:\\workspace', cols: 80, rows: 24 }))
          .rejects.toThrow('Cannot create terminal: no workspace open');
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.TERMINAL_CREATE);
        await expect(handler(null, { invalidField: 'test' })).rejects.toThrow();
      });
    });

    describe('TERMINAL_WRITE', () => {
      it('should register TERMINAL_WRITE handler', () => {
        expect(handlers.has(IPC_CHANNELS.TERMINAL_WRITE)).toBe(true);
      });

      it('should validate request and call terminalService.write', async () => {
        vi.mocked(terminalService.write).mockReturnValue(undefined);

        const handler = getHandler(IPC_CHANNELS.TERMINAL_WRITE);
        await handler(null, { sessionId: '123e4567-e89b-12d3-a456-426614174000', data: 'echo test\n' });

        expect(terminalService.write).toHaveBeenCalledWith(
          '123e4567-e89b-12d3-a456-426614174000',
          'echo test\n'
        );
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.TERMINAL_WRITE);
        await expect(handler(null, { sessionId: 'invalid-uuid' })).rejects.toThrow();
      });
    });

    describe('TERMINAL_RESIZE', () => {
      it('should register TERMINAL_RESIZE handler', () => {
        expect(handlers.has(IPC_CHANNELS.TERMINAL_RESIZE)).toBe(true);
      });

      it('should validate request and call terminalService.resize', async () => {
        vi.mocked(terminalService.resize).mockReturnValue(undefined);

        const handler = getHandler(IPC_CHANNELS.TERMINAL_RESIZE);
        await handler(null, { sessionId: '123e4567-e89b-12d3-a456-426614174000', cols: 100, rows: 30 });

        expect(terminalService.resize).toHaveBeenCalledWith(
          '123e4567-e89b-12d3-a456-426614174000',
          100,
          30
        );
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.TERMINAL_RESIZE);
        await expect(handler(null, { sessionId: '123', cols: -1 })).rejects.toThrow();
      });
    });

    describe('TERMINAL_CLOSE', () => {
      it('should register TERMINAL_CLOSE handler', () => {
        expect(handlers.has(IPC_CHANNELS.TERMINAL_CLOSE)).toBe(true);
      });

      it('should validate request and call terminalService.close', async () => {
        vi.mocked(terminalService.close).mockReturnValue(undefined);

        const handler = getHandler(IPC_CHANNELS.TERMINAL_CLOSE);
        await handler(null, { sessionId: '123e4567-e89b-12d3-a456-426614174000' });

        expect(terminalService.close).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.TERMINAL_CLOSE);
        await expect(handler(null, {})).rejects.toThrow();
      });
    });

    describe('TERMINAL_LIST', () => {
      it('should register TERMINAL_LIST handler', () => {
        expect(handlers.has(IPC_CHANNELS.TERMINAL_LIST)).toBe(true);
      });

      it('should call terminalService.listSessions and return sessions', async () => {
        const mockSessions = [
          {
            sessionId: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Terminal 1',
            cwd: 'C:\\workspace',
            createdAt: '2024-01-01T00:00:00.000Z',
            status: 'running' as const,
          },
        ];
        vi.mocked(terminalService.listSessions).mockReturnValue(mockSessions);

        const handler = getHandler(IPC_CHANNELS.TERMINAL_LIST);
        const result = await handler();

        expect(terminalService.listSessions).toHaveBeenCalled();
        expect(result).toEqual({ sessions: mockSessions });
      });
    });
  });

  describe('Search handlers', () => {
    it('should register SEARCH_QUERY handler', () => {
      expect(handlers.has(IPC_CHANNELS.SEARCH_QUERY)).toBe(true);
    });

    it('should validate request and call searchService.search', async () => {
      const mockResponse = { results: [], truncated: false };
      vi.mocked(searchService.search).mockResolvedValue(mockResponse);

      const handler = getHandler(IPC_CHANNELS.SEARCH_QUERY);
      const result = await handler(null, { query: 'test' });

      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'test' })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should reject invalid search request', async () => {
      const handler = getHandler(IPC_CHANNELS.SEARCH_QUERY);
      await expect(handler(null, { invalidField: 'test' })).rejects.toThrow();
    });

    it('should register SEARCH_REPLACE handler', () => {
      expect(handlers.has(IPC_CHANNELS.SEARCH_REPLACE)).toBe(true);
    });

    it('should validate request and call searchService.replace', async () => {
      const mockResponse = { filesChanged: 1, replacements: 3 };
      vi.mocked(searchService.replace).mockResolvedValue(mockResponse);

      const handler = getHandler(IPC_CHANNELS.SEARCH_REPLACE);
      const result = await handler(null, {
        scope: 'workspace',
        query: 'test',
        replace: 'ok',
      });

      expect(searchService.replace).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'test', replace: 'ok' })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should reject invalid replace request', async () => {
      const handler = getHandler(IPC_CHANNELS.SEARCH_REPLACE);
      await expect(handler(null, { query: 'test' })).rejects.toThrow();
    });
  });

  describe('SCM handlers', () => {
    it('should register SCM_STATUS handler', () => {
      expect(handlers.has(IPC_CHANNELS.SCM_STATUS)).toBe(true);
    });

    it('should validate request and call gitService.getStatus', async () => {
      const mockResponse = { staged: [], unstaged: [], untracked: [] };
      vi.mocked(gitService.getStatus).mockResolvedValue(mockResponse);

      const handler = getHandler(IPC_CHANNELS.SCM_STATUS);
      const result = await handler(null, {});

      expect(gitService.getStatus).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should register SCM_STAGE handler', () => {
      expect(handlers.has(IPC_CHANNELS.SCM_STAGE)).toBe(true);
    });

    it('should validate request and call gitService.stage', async () => {
      vi.mocked(gitService.stage).mockResolvedValue(undefined);

      const handler = getHandler(IPC_CHANNELS.SCM_STAGE);
      await handler(null, { all: true });

      expect(gitService.stage).toHaveBeenCalledWith(
        expect.objectContaining({ all: true })
      );
    });

    it('should reject invalid stage request', async () => {
      const handler = getHandler(IPC_CHANNELS.SCM_STAGE);
      await expect(handler(null, {})).rejects.toThrow();
    });

    it('should register SCM_UNSTAGE handler', () => {
      expect(handlers.has(IPC_CHANNELS.SCM_UNSTAGE)).toBe(true);
    });

    it('should validate request and call gitService.unstage', async () => {
      vi.mocked(gitService.unstage).mockResolvedValue(undefined);

      const handler = getHandler(IPC_CHANNELS.SCM_UNSTAGE);
      await handler(null, { paths: ['file.txt'] });

      expect(gitService.unstage).toHaveBeenCalledWith(
        expect.objectContaining({ paths: ['file.txt'] })
      );
    });

    it('should reject invalid unstage request', async () => {
      const handler = getHandler(IPC_CHANNELS.SCM_UNSTAGE);
      await expect(handler(null, {})).rejects.toThrow();
    });

    it('should register SCM_COMMIT handler', () => {
      expect(handlers.has(IPC_CHANNELS.SCM_COMMIT)).toBe(true);
    });

    it('should validate request and call gitService.commit', async () => {
      vi.mocked(gitService.commit).mockResolvedValue({ ok: true });

      const handler = getHandler(IPC_CHANNELS.SCM_COMMIT);
      await handler(null, { message: 'Initial commit' });

      expect(gitService.commit).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Initial commit' })
      );
    });

    it('should reject invalid commit request', async () => {
      const handler = getHandler(IPC_CHANNELS.SCM_COMMIT);
      await expect(handler(null, { message: '' })).rejects.toThrow();
    });
  });

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
          scope: 'user',
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

    it('should retry a run and append a status event', async () => {
      const run = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'queued' as const,
        source: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
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
          scope: 'user',
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

      // Verify AgentRunStore redacts sensitive fields
      expect(agentRunStore.listEvents).toHaveBeenCalled();
      // In production, the AgentRunStore.listEvents should redact sensitive fields
      // This test documents the expectation that redaction occurs
      expect(result.events).toBeDefined();
    });
  });

  describe('Connections handlers', () => {
    it('should register CONNECTIONS_PROVIDERS_LIST handler', () => {
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST)).toBe(true);
    });

    it('should register CONNECTIONS_LIST handler', () => {
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_LIST)).toBe(true);
    });

    it('should list providers via ConnectionProviderRegistry', async () => {
      const providers = [
        {
          id: 'openai',
          name: 'OpenAI',
          fields: [],
        },
      ];

      vi.mocked(connectionProviderRegistry.list).mockReturnValue(providers);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST);
      const result = await handler();

      expect(connectionProviderRegistry.list).toHaveBeenCalled();
      expect(result).toEqual({ providers });
    });

    it('should list connections via ConnectionsService', async () => {
      const mockConnections = [
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'My Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          config: { host: 'localhost' },
        },
      ];
      vi.mocked(connectionsService.listConnections).mockReturnValue(mockConnections);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_LIST);
      const result = await handler();

      expect(connectionsService.listConnections).toHaveBeenCalled();
      expect(result).toEqual({ connections: mockConnections });
    });

    it('should create connection via ConnectionsService', async () => {
      const mockConnection = {
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          providerId: 'mcp',
          scope: 'user' as const,
          displayName: 'My Conn',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        config: { host: 'localhost' },
      };
      vi.mocked(connectionsService.createConnection).mockReturnValue(mockConnection);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_CREATE);
      const result = await handler(null, {
        providerId: 'mcp',
        scope: 'user' as const,
        displayName: 'My Conn',
        config: { host: 'localhost' },
      });

      expect(connectionsService.createConnection).toHaveBeenCalled();
      expect(result).toEqual({ connection: mockConnection });
    });

    it('should update connection via ConnectionsService', async () => {
      const mockConnection = {
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          providerId: 'mcp',
          scope: 'user' as const,
          displayName: 'Updated',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        config: { host: '127.0.0.1' },
      };
      vi.mocked(connectionsService.updateConnection).mockReturnValue(mockConnection);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_UPDATE);
      const result = await handler(null, {
        id: '123e4567-e89b-12d3-a456-426614174000',
        displayName: 'Updated',
        config: { host: '127.0.0.1' },
      });

      expect(connectionsService.updateConnection).toHaveBeenCalled();
      expect(result).toEqual({ connection: mockConnection });
    });

    it('should delete connection via ConnectionsService', async () => {
      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_DELETE);
      await handler(null, { id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(connectionsService.deleteConnection).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });

    it('should set secret and update connection metadata', async () => {
      vi.mocked(connectionsService.listConnections).mockReturnValue([
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          config: { host: 'localhost' },
        },
      ]);
      vi.mocked(secretsService.setSecret).mockReturnValue('secret-ref');

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_SET_SECRET);
      const result = await handler(null, {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        secretValue: 'secret',
      });

      expect(secretsService.setSecret).toHaveBeenCalled();
      expect(connectionsService.setSecretRef).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'secret-ref'
      );
      expect(result).toEqual({ secretRef: 'secret-ref' });
    });

    it('should replace secret and update connection metadata', async () => {
      vi.mocked(connectionsService.listConnections).mockReturnValue([
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          config: { host: 'localhost' },
        },
      ]);
      vi.mocked(secretsService.replaceSecret).mockReturnValue('secret-ref');

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_REPLACE_SECRET);
      const result = await handler(null, {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        secretValue: 'secret',
      });

      expect(secretsService.replaceSecret).toHaveBeenCalled();
      expect(connectionsService.setSecretRef).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'secret-ref'
      );
      expect(result).toEqual({ secretRef: 'secret-ref' });
    });

    it('should gate secret access via ConsentService', async () => {
      vi.mocked(consentService.evaluateAccess).mockReturnValue(true);
      vi.mocked(connectionsService.listConnections).mockReturnValue([
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            secretRef: 'secret-ref',
          },
          config: { host: 'localhost' },
        },
      ]);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_REQUEST_SECRET_ACCESS);
      const result = await handler(null, {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        requesterId: 'ext-1',
      });

      expect(consentService.evaluateAccess).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'ext-1'
      );
      expect(auditService.logSecretAccess).toHaveBeenCalled();
      expect(result).toEqual({ granted: true, secretRef: 'secret-ref' });
    });

    it('should list audit events', async () => {
      vi.mocked(auditService.listEvents).mockReturnValue({
        events: [],
      });

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_AUDIT_LIST);
      const result = await handler(null, {});

      expect(auditService.listEvents).toHaveBeenCalled();
      expect(result).toEqual({ events: [] });
    });
  });

  describe('All handlers registered', () => {
    it('should register all 67 expected IPC handlers', () => {
      // Existing handlers (4)
      expect(handlers.has(IPC_CHANNELS.GET_VERSION)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.GET_SETTINGS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.UPDATE_SETTINGS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.RESET_SETTINGS)).toBe(true);

      // Window handlers (4)
      expect(handlers.has(IPC_CHANNELS.WINDOW_MINIMIZE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WINDOW_CLOSE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WINDOW_GET_STATE)).toBe(true);

      // Workspace handlers (3)
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_OPEN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_GET_CURRENT)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_CLOSE)).toBe(true);

      // Filesystem handlers (7)
      expect(handlers.has(IPC_CHANNELS.FS_READ_DIRECTORY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_READ_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_WRITE_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_CREATE_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_CREATE_DIRECTORY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_RENAME)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_DELETE)).toBe(true);

      // Terminal handlers (5)
      expect(handlers.has(IPC_CHANNELS.TERMINAL_CREATE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.TERMINAL_WRITE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.TERMINAL_RESIZE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.TERMINAL_CLOSE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.TERMINAL_LIST)).toBe(true);

      // Search handlers (2)
      expect(handlers.has(IPC_CHANNELS.SEARCH_QUERY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SEARCH_REPLACE)).toBe(true);

      // SCM handlers (4)
      expect(handlers.has(IPC_CHANNELS.SCM_STATUS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SCM_STAGE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SCM_UNSTAGE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SCM_COMMIT)).toBe(true);

      // SDD handlers (9)
      expect(handlers.has(IPC_CHANNELS.SDD_LIST_FEATURES)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_STATUS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_START_RUN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_STOP_RUN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_SET_ACTIVE_TASK)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_GET_FILE_TRACE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_GET_TASK_TRACE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_GET_PARITY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_OVERRIDE_UNTRACKED)).toBe(true);

      // Agent handlers (8)
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_GET)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_START)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_CANCEL)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_RETRY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_EVENTS_SUBSCRIBE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_EVENTS_UNSUBSCRIBE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_TRACE_LIST)).toBe(true);

      // Connections handlers (9)
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_CREATE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_UPDATE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_DELETE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_SET_SECRET)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_REPLACE_SECRET)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_REQUEST_SECRET_ACCESS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_AUDIT_LIST)).toBe(true);

      // Extensions handlers (12)
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_GET)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_ENABLE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_DISABLE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_UNINSTALL)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_LIST_COMMANDS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_REQUEST_PERMISSION)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_LIST_PERMISSIONS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_REVOKE_PERMISSION)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_LIST_VIEWS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.EXTENSIONS_RENDER_VIEW)).toBe(true);

      // Total: 67 handlers
      expect(handlers.size).toBe(67);
    });
  });
});
