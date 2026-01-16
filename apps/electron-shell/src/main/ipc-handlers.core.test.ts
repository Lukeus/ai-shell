import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerIPCHandlers } from './ipc-handlers';
import { workspaceService } from './services/WorkspaceService';
import { fsBrokerService } from './services/FsBrokerService';
import { terminalService } from './services/TerminalService';
import { outputService } from './services/OutputService';
import { searchService } from './services/SearchService';
import { gitService } from './services/GitService';
import { settingsService } from './services/SettingsService';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => 'C:\\temp'),
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('./ipc/agents', () => ({
  registerAgentHandlers: vi.fn(),
}));

vi.mock('./ipc/diagnostics', () => ({
  registerDiagnosticsHandlers: vi.fn(),
}));

vi.mock('./ipc/extensions', () => ({
  registerExtensionHandlers: vi.fn(),
}));

vi.mock('./ipc/mcp', () => ({
  registerMcpHandlers: vi.fn(),
}));

vi.mock('./ipc/testOnly', () => ({
  registerTestOnlyHandlers: vi.fn(),
}));

vi.mock('./index', () => ({
  getAgentHostManager: vi.fn(() => null),
  getExtensionCommandService: vi.fn(() => null),
  getExtensionRegistry: vi.fn(() => null),
  getExtensionViewService: vi.fn(() => null),
  getExtensionToolService: vi.fn(() => null),
  getPermissionService: vi.fn(() => null),
}));

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

vi.mock('./services/OutputService', () => ({
  outputService: {
    append: vi.fn(),
    clear: vi.fn(),
    listChannels: vi.fn(),
    read: vi.fn(),
    onAppend: vi.fn(() => vi.fn()),
    onClear: vi.fn(() => vi.fn()),
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

vi.mock('./services/SddTraceService', () => ({
  sddTraceService: {
    onStatusChange: vi.fn(),
    setEnabled: vi.fn(),
  },
}));

vi.mock('./services/SddWatcher', () => ({
  sddWatcher: {
    setEnabled: vi.fn(),
  },
}));

describe('IPC Handlers - Core', () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    vi.mocked(settingsService.getSettings).mockReturnValue(SETTINGS_DEFAULTS);
    vi.mocked(sddTraceService.onStatusChange).mockReturnValue(() => undefined);
    vi.mocked(sddTraceService.setEnabled).mockResolvedValue(undefined);
    vi.mocked(sddWatcher.setEnabled).mockReturnValue(undefined);

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, handler);
      return ipcMain;
    });

    registerIPCHandlers();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

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

        expect(terminalService.close).toHaveBeenCalledWith(
          '123e4567-e89b-12d3-a456-426614174000'
        );
      });

      it('should reject invalid request', async () => {
        const handler = getHandler(IPC_CHANNELS.TERMINAL_CLOSE);
        await expect(handler(null, { sessionId: 'invalid-uuid' })).rejects.toThrow();
      });
    });

    describe('TERMINAL_LIST', () => {
      it('should register TERMINAL_LIST handler', () => {
        expect(handlers.has(IPC_CHANNELS.TERMINAL_LIST)).toBe(true);
      });

      it('should list active terminal sessions', async () => {
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
      const mockResponse = { branch: 'main', staged: [], unstaged: [], untracked: [] };
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

  describe('Output handlers', () => {
    it('should register OUTPUT_APPEND handler', () => {
      expect(handlers.has(IPC_CHANNELS.OUTPUT_APPEND)).toBe(true);
    });

    it('should validate and call outputService.append', async () => {
      const payload = { channelId: 'test', lines: ['hello'] };
      const handler = getHandler(IPC_CHANNELS.OUTPUT_APPEND);
      await handler(null, payload);
      expect(outputService.append).toHaveBeenCalledWith(payload);
    });

    it('should register OUTPUT_CLEAR handler', () => {
      expect(handlers.has(IPC_CHANNELS.OUTPUT_CLEAR)).toBe(true);
    });

    it('should validate and call outputService.clear', async () => {
      const payload = { channelId: 'test' };
      const handler = getHandler(IPC_CHANNELS.OUTPUT_CLEAR);
      await handler(null, payload);
      expect(outputService.clear).toHaveBeenCalledWith(payload);
    });

    it('should register OUTPUT_LIST_CHANNELS handler', () => {
      expect(handlers.has(IPC_CHANNELS.OUTPUT_LIST_CHANNELS)).toBe(true);
    });

    it('should call outputService.listChannels', async () => {
      const mockChannels = { channels: [] };
      vi.mocked(outputService.listChannels).mockReturnValue(mockChannels);
      const handler = getHandler(IPC_CHANNELS.OUTPUT_LIST_CHANNELS);
      const result = await handler(null, {});
      expect(outputService.listChannels).toHaveBeenCalled();
      expect(result).toEqual(mockChannels);
    });

    it('should register OUTPUT_READ handler', () => {
      expect(handlers.has(IPC_CHANNELS.OUTPUT_READ)).toBe(true);
    });

    it('should validate and call outputService.read', async () => {
      const payload = { channelId: 'test', startLine: 1, maxLines: 10 };
      const mockResponse = { channel: {} as any, lines: [], totalLines: 0, hasMore: false };
      vi.mocked(outputService.read).mockReturnValue(mockResponse);
      const handler = getHandler(IPC_CHANNELS.OUTPUT_READ);
      const result = await handler(null, payload);
      expect(outputService.read).toHaveBeenCalledWith(expect.objectContaining(payload));
      expect(result).toEqual(mockResponse);
    });
  });
});
