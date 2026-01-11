import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerIPCHandlers } from './ipc-handlers';
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
    logSddProposalApply: vi.fn(),
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
    resetRunEvents: vi.fn(),
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

vi.mock('./services/PatchApplyService', () => ({
  patchApplyService: {
    applyProposal: vi.fn(),
  },
}));

vi.mock('./services/SddRunCoordinator', () => ({
  sddRunCoordinator: {
    attachAgentHost: vi.fn(),
    startRun: vi.fn(),
    controlRun: vi.fn(),
  },
}));

vi.mock('./services/DiagnosticsService', () => ({
  diagnosticsService: {
    reportError: vi.fn(),
    getLogPath: vi.fn(),
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

describe('IPC Handlers - Registration', () => {
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

  describe('All handlers registered', () => {
    it('should register all 78 expected IPC handlers', () => {
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

      // Diagnostics handlers (3)
      expect(handlers.has(IPC_CHANNELS.DIAG_REPORT_ERROR)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.DIAG_GET_LOG_PATH)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.DIAG_SET_SAFE_MODE)).toBe(true);

      // SDD handlers (12)
      expect(handlers.has(IPC_CHANNELS.SDD_LIST_FEATURES)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_STATUS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_START_RUN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_STOP_RUN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_SET_ACTIVE_TASK)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_GET_FILE_TRACE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_GET_TASK_TRACE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_GET_PARITY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_OVERRIDE_UNTRACKED)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_PROPOSAL_APPLY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_RUNS_START)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SDD_RUNS_CONTROL)).toBe(true);

      // Agent handlers (15)
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_GET)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_START)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_CANCEL)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_RUNS_RETRY)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_EVENTS_SUBSCRIBE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_EVENTS_UNSUBSCRIBE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_TRACE_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_CONVERSATIONS_LIST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_CONVERSATIONS_CREATE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_CONVERSATIONS_GET)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_MESSAGES_APPEND)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_DRAFTS_SAVE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_EDITS_REQUEST)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AGENT_EDITS_APPLY_PROPOSAL)).toBe(true);

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

      // Test-only handlers (1)
      expect(handlers.has(IPC_CHANNELS.TEST_FORCE_CRASH_RENDERER)).toBe(true);

      // Output handlers (4)
      expect(handlers.has(IPC_CHANNELS.OUTPUT_APPEND)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.OUTPUT_CLEAR)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.OUTPUT_LIST_CHANNELS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.OUTPUT_READ)).toBe(true);

      // Total: 85 handlers
      expect(handlers.size).toBe(85);
    });
  });
});
