import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from 'packages-api-contracts';
import { registerIPCHandlers } from './ipc-handlers';
import { workspaceService } from './services/WorkspaceService';
import { fsBrokerService } from './services/FsBrokerService';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
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

vi.mock('./services/FsBrokerService', () => ({
  fsBrokerService: {
    readDirectory: vi.fn(),
    readFile: vi.fn(),
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


describe('IPC Handlers', () => {
  // Store handlers for testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();
    handlers.clear();

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

  describe('All handlers registered', () => {
    it('should register all 13 expected IPC handlers', () => {
      // Existing handlers (4)
      expect(handlers.has(IPC_CHANNELS.GET_VERSION)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.GET_SETTINGS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.UPDATE_SETTINGS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.RESET_SETTINGS)).toBe(true);

      // Workspace handlers (3)
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_OPEN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_GET_CURRENT)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.WORKSPACE_CLOSE)).toBe(true);

      // Filesystem handlers (6)
      expect(handlers.has(IPC_CHANNELS.FS_READ_DIRECTORY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_READ_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_CREATE_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_CREATE_DIRECTORY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_RENAME)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FS_DELETE)).toBe(true);

      // Total: 13 handlers
      expect(handlers.size).toBe(13);
    });
  });
});
