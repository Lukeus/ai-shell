import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from 'packages-api-contracts';
import { registerDiagnosticsHandlers } from './ipc/diagnostics';
import { diagnosticsService } from './services/DiagnosticsService';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('./services/DiagnosticsService', () => ({
  diagnosticsService: {
    reportError: vi.fn(),
    getLogPath: vi.fn(),
  },
}));

vi.mock('./services/RuntimeStateService', () => ({
  runtimeStateService: {
    setSafeMode: vi.fn(() => ({ safeMode: false })),
  },
}));

describe('IPC Handlers - Diagnostics', () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();

    vi.mocked(diagnosticsService.getLogPath).mockResolvedValue('C:\\logs\\ai-shell.log');

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, handler);
      return ipcMain;
    });

    registerDiagnosticsHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getHandler(channel: string) {
    const handler = handlers.get(channel);
    expect(handler).toBeDefined();
    return handler!;
  }

  describe('Diagnostics handlers', () => {
    it('should register DIAG_REPORT_ERROR handler', () => {
      expect(handlers.has(IPC_CHANNELS.DIAG_REPORT_ERROR)).toBe(true);
    });

    it('should register DIAG_GET_LOG_PATH handler', () => {
      expect(handlers.has(IPC_CHANNELS.DIAG_GET_LOG_PATH)).toBe(true);
    });

    it('should register DIAG_SET_SAFE_MODE handler', () => {
      expect(handlers.has(IPC_CHANNELS.DIAG_SET_SAFE_MODE)).toBe(true);
    });

    it('should report errors via DiagnosticsService', async () => {
      const handler = getHandler(IPC_CHANNELS.DIAG_REPORT_ERROR);
      const payload = {
        source: 'renderer',
        message: 'Crash',
        timestamp: new Date().toISOString(),
      };
      const result = await handler(null, payload);

      expect(diagnosticsService.reportError).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('should return log path via DiagnosticsService', async () => {
      const handler = getHandler(IPC_CHANNELS.DIAG_GET_LOG_PATH);
      const result = await handler(null, {});
      expect(result).toEqual({ ok: true, value: { path: 'C:\\logs\\ai-shell.log' } });
    });
  });
});
