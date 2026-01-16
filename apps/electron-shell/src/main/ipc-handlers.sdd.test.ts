import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerIPCHandlers } from './ipc-handlers';
import { workspaceService } from './services/WorkspaceService';
import { patchApplyService } from './services/PatchApplyService';
import { auditService } from './services/AuditService';
import { sddRunCoordinator } from './services/SddRunCoordinator';
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

const workspaceServiceMock = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
}));

vi.mock('./services/WorkspaceService', () => ({
  workspaceService: workspaceServiceMock,
  WorkspaceService: {
    getInstance: vi.fn(() => workspaceServiceMock),
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

vi.mock('./services/PatchApplyService', () => ({
  patchApplyService: {
    applyProposal: vi.fn(),
  },
}));

vi.mock('./services/AuditService', () => ({
  auditService: {
    logSddProposalApply: vi.fn(),
  },
}));

vi.mock('./services/SddRunCoordinator', () => ({
  sddRunCoordinator: {
    attachAgentHost: vi.fn(),
    startRun: vi.fn(),
    controlRun: vi.fn(),
  },
}));

vi.mock('./services/SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
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

vi.mock('./services/OutputService', () => ({
  outputService: {
    onAppend: vi.fn(() => vi.fn()),
    onClear: vi.fn(() => vi.fn()),
  },
}));

vi.mock('./index', () => ({
  getAgentHostManager: vi.fn(() => null),
}));

describe('IPC Handlers - SDD', () => {
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

  describe('SDD handlers', () => {
    it('should register SDD_PROPOSAL_APPLY handler', () => {
      expect(handlers.has(IPC_CHANNELS.SDD_PROPOSAL_APPLY)).toBe(true);
    });

    it('should register SDD_RUNS_START and SDD_RUNS_CONTROL handlers', () => {
      expect(handlers.has(IPC_CHANNELS.SDD_RUNS_START)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_RUNS_CONTROL)).toBe(true);
    });

    it('should apply a proposal and audit success', async () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue({
        path: 'C:\\workspace',
        name: 'workspace',
      });
      vi.mocked(patchApplyService.applyProposal).mockResolvedValue({
        files: ['specs/151-sdd-workflow/spec.md'],
        summary: { filesChanged: 1, additions: 1, deletions: 0 },
      });

      const handler = getHandler(IPC_CHANNELS.SDD_PROPOSAL_APPLY);
      await handler(null, {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        proposal: {
          writes: [],
          summary: { filesChanged: 0 },
        },
      });

      expect(patchApplyService.applyProposal).toHaveBeenCalled();
      expect(auditService.logSddProposalApply).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'success',
          filesChanged: 1,
        })
      );
    });

    it('should start an SDD workflow run', async () => {
      const handler = getHandler(IPC_CHANNELS.SDD_RUNS_START);
      await handler(null, {
        featureId: '151-sdd-workflow',
        goal: 'Ship SDD workflow',
      });

      expect(sddRunCoordinator.attachAgentHost).toHaveBeenCalled();
      expect(sddRunCoordinator.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId: '151-sdd-workflow',
          goal: 'Ship SDD workflow',
        })
      );
    });

    it('should control an SDD workflow run', async () => {
      const handler = getHandler(IPC_CHANNELS.SDD_RUNS_CONTROL);
      await handler(null, {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        action: 'cancel',
      });

      expect(sddRunCoordinator.attachAgentHost).toHaveBeenCalled();
      expect(sddRunCoordinator.controlRun).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'cancel',
        })
      );
    });

    it('should audit failure when proposal apply errors', async () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue({
        path: 'C:\\workspace',
        name: 'workspace',
      });
      vi.mocked(patchApplyService.applyProposal).mockRejectedValue(new Error('boom'));

      const handler = getHandler(IPC_CHANNELS.SDD_PROPOSAL_APPLY);
      await expect(
        handler(null, {
          runId: '123e4567-e89b-12d3-a456-426614174000',
          proposal: {
            writes: [],
            summary: { filesChanged: 0 },
          },
        })
      ).rejects.toThrow('boom');

      expect(auditService.logSddProposalApply).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'error',
        })
      );
    });
  });
});
