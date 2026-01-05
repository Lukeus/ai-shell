import { ipcMain, app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  IPC_CHANNELS,
  AppInfo,
  Settings,
  PartialSettings,
  Workspace,
  ReadDirectoryRequestSchema,
  ReadDirectoryResponse,
  ReadFileRequestSchema,
  ReadFileResponse,
  WriteFileRequestSchema,
  CreateFileRequestSchema,
  CreateDirectoryRequestSchema,
  RenameRequestSchema,
  DeleteRequestSchema,
  CreateTerminalRequestSchema,
  CreateTerminalResponse,
  TerminalWriteRequestSchema,
  TerminalResizeRequestSchema,
  TerminalCloseRequestSchema,
  ListTerminalsResponse,
  CreateConnectionRequestSchema,
  CreateConnectionResponse,
  UpdateConnectionRequestSchema,
  UpdateConnectionResponse,
  DeleteConnectionRequestSchema,
  ListConnectionsResponse,
  ListProvidersResponse,
  SetSecretRequestSchema,
  SetSecretResponse,
  ReplaceSecretRequestSchema,
  ReplaceSecretResponse,
  SecretAccessRequestSchema,
  SecretAccessResponse,
  ListAuditEventsRequestSchema,
  ListAuditEventsResponse,
  WindowStateSchema,
  SearchRequestSchema,
  SearchResponse,
  ReplaceRequestSchema,
  ReplaceResponse,
  ScmStatusRequestSchema,
  ScmStatusResponse,
  ScmStageRequestSchema,
  ScmUnstageRequestSchema,
  ScmCommitRequestSchema,
  ScmCommitResponse,
  SddListFeaturesRequestSchema,
  SddListFeaturesResponse,
  SddStartRunRequestSchema,
  SddRun,
  SddStopRunRequestSchema,
  SddSetActiveTaskRequestSchema,
  SddGetFileTraceRequestSchema,
  SddFileTraceResponse,
  SddGetTaskTraceRequestSchema,
  SddTaskTraceResponse,
  SddGetParityRequestSchema,
  SddParity,
  SddOverrideUntrackedRequestSchema,
  SddStatus,
  SddStatusSchema,
  SddStatusRequestSchema,
  SddProposalApplyRequestSchema,
  SddRunStartRequestSchema,
  SddRunControlRequestSchema,
  AppendOutputRequestSchema,
  ClearOutputRequestSchema,
  ListOutputChannelsRequestSchema,
  ReadOutputRequestSchema,
  type OutputAppendEvent,
  type OutputClearEvent,
} from 'packages-api-contracts';
import { settingsService } from './services/SettingsService';
import { workspaceService } from './services/WorkspaceService';
import { fsBrokerService } from './services/FsBrokerService';
import { terminalService } from './services/TerminalService';
import { outputService } from './services/OutputService';
import { searchService } from './services/SearchService';
import { gitService } from './services/GitService';
import { connectionsService } from './services/ConnectionsService';
import { connectionProviderRegistry } from './services/ConnectionProviderRegistry';
import { secretsService } from './services/SecretsService';
import { consentService } from './services/ConsentService';
import { auditService } from './services/AuditService';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';
import { resolvePathWithinWorkspace } from './services/workspace-paths';
import { patchApplyService } from './services/PatchApplyService';
import { sddRunCoordinator } from './services/SddRunCoordinator';
import { registerAgentHandlers } from './ipc/agents';
import { registerDiagnosticsHandlers } from './ipc/diagnostics';
import { registerExtensionHandlers } from './ipc/extensions';
import { registerTestOnlyHandlers } from './ipc/testOnly';
import { getAgentHostManager } from './index';

const getWindowFromEvent = (event: Electron.IpcMainInvokeEvent): BrowserWindow | null => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window ?? null;
};

let sddBindingsReady = false;

const publishOutputAppend = (event: OutputAppendEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    const contents = window.webContents;
    if (contents.isDestroyed()) continue;
    try {
      contents.send(IPC_CHANNELS.OUTPUT_ON_APPEND, event);
    } catch {
      // Ignore
    }
  }
};

const publishOutputClear = (event: OutputClearEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    const contents = window.webContents;
    if (contents.isDestroyed()) continue;
    try {
      contents.send(IPC_CHANNELS.OUTPUT_ON_CLEAR, event);
    } catch {
      // Ignore
    }
  }
};

let outputBindingsReady = false;

const ensureOutputBindings = (): void => {
  if (outputBindingsReady) {
    return;
  }

  outputService.onAppend((event) => {
    publishOutputAppend(event);
  });

  outputService.onClear((event) => {
    publishOutputClear(event);
  });

  outputBindingsReady = true;
};

const publishSddStatus = (status: SddStatus): void => {
  let validated: SddStatus;
  try {
    validated = SddStatusSchema.parse(status);
  } catch {
    return;
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    const contents = window.webContents;
    if (contents.isDestroyed()) {
      continue;
    }
    try {
      contents.send(IPC_CHANNELS.SDD_CHANGED, validated);
    } catch {
      // Ignore send failures for closing windows.
    }
  }
};

const ensureSddBindings = (): void => {
  if (sddBindingsReady) {
    return;
  }

  sddTraceService.onStatusChange((status) => {
    publishSddStatus(status);
  });

  sddBindingsReady = true;
};

const applySddSettings = async (settings: Settings): Promise<void> => {
  if (!settings.sdd.enabled) {
    sddWatcher.setEnabled(false);
    try {
      await sddTraceService.setEnabled(false);
    } catch {
      // Ignore failures when workspace is unavailable during shutdown.
    }
    return;
  }

  try {
    await sddTraceService.setEnabled(true);
  } catch {
    // Ignore failures to avoid blocking settings updates.
  }
  try {
    sddWatcher.setEnabled(true);
  } catch {
    // Ignore watcher startup failures when workspace is unavailable.
  }
};

const isFile = async (filePath: string): Promise<boolean> => {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
};

const listSddFeatures = async (): Promise<SddListFeaturesResponse> => {
  const workspace = workspaceService.getWorkspace();
  if (!workspace) {
    return [];
  }

  const specsRoot = path.join(workspace.path, 'specs');
  if (!fs.existsSync(specsRoot)) {
    return [];
  }

  let dirents: fs.Dirent[];
  try {
    dirents = await fs.promises.readdir(specsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const features: SddListFeaturesResponse = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const featureId = dirent.name;
    const featureRoot = path.join(specsRoot, featureId);
    const specCandidate = path.join(featureRoot, 'spec.md');

    if (!(await isFile(specCandidate))) {
      continue;
    }

    let specPath: string;
    try {
      specPath = await resolvePathWithinWorkspace(specCandidate, workspace.path);
    } catch {
      continue;
    }

    const summary: SddListFeaturesResponse[number] = {
      featureId,
      specPath,
    };

    const planCandidate = path.join(featureRoot, 'plan.md');
    if (await isFile(planCandidate)) {
      try {
        summary.planPath = await resolvePathWithinWorkspace(planCandidate, workspace.path);
      } catch {
        // Ignore invalid plan path.
      }
    }

    const tasksCandidate = path.join(featureRoot, 'tasks.md');
    if (await isFile(tasksCandidate)) {
      try {
        summary.tasksPath = await resolvePathWithinWorkspace(tasksCandidate, workspace.path);
      } catch {
        // Ignore invalid tasks path.
      }
    }

    features.push(summary);
  }

  features.sort((a, b) => a.featureId.localeCompare(b.featureId));
  return features;
};

/**
 * Register all IPC handlers for main process.
 * P6 (Contracts-first): Uses IPC_CHANNELS from api-contracts
 * P1 (Process isolation): Main process owns OS access
 */
export function registerIPCHandlers(): void {
  ensureSddBindings();
  ensureOutputBindings();
  void applySddSettings(settingsService.getSettings());
  registerAgentHandlers();
  registerDiagnosticsHandlers();
  registerExtensionHandlers();
  registerTestOnlyHandlers();
  // Handler for GET_VERSION channel
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async (): Promise<AppInfo> => {
    const info: AppInfo = {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
    return info;
  });

  // Handler for GET_SETTINGS channel
  // Returns all application settings from SettingsService
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async (): Promise<Settings> => {
    return settingsService.getSettings();
  });

  // Handler for UPDATE_SETTINGS channel
  // Accepts partial settings, validates, merges, and persists
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_SETTINGS,
    async (_event, updates: PartialSettings): Promise<Settings> => {
      const previous = settingsService.getSettings();
      const updated = settingsService.updateSettings(updates);
      if (previous.sdd.enabled !== updated.sdd.enabled) {
        void applySddSettings(updated);
      }
      return updated;
    }
  );

  // Handler for RESET_SETTINGS channel
  // Resets all settings to defaults
  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async (): Promise<Settings> => {
    const previous = settingsService.getSettings();
    const reset = settingsService.resetSettings();
    if (previous.sdd.enabled !== reset.sdd.enabled) {
      void applySddSettings(reset);
    }
    return reset;
  });

  // ========================================
  // Workspace IPC Handlers
  // ========================================

  /**
   * Handler for WORKSPACE_OPEN channel.
   * Opens native folder picker dialog and sets workspace.
   * 
   * @returns Workspace object if folder selected, null if cancelled
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN, async (): Promise<Workspace | null> => {
    return workspaceService.openWorkspace();
  });

  /**
   * Handler for WORKSPACE_GET_CURRENT channel.
   * Returns current workspace or null if none open.
   * 
   * @returns Current Workspace or null
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_CURRENT, async (): Promise<Workspace | null> => {
    return workspaceService.getWorkspace();
  });

  /**
   * Handler for WORKSPACE_CLOSE channel.
   * Clears current workspace.
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CLOSE, async (): Promise<void> => {
    workspaceService.clearWorkspace();
  });

  // ========================================
  // Window Controls IPC Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event): Promise<void> => {
    const window = getWindowFromEvent(event);
    window?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, async (event): Promise<void> => {
    const window = getWindowFromEvent(event);
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event): Promise<void> => {
    const window = getWindowFromEvent(event);
    window?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, async (event) => {
    const window = getWindowFromEvent(event);
    const state = WindowStateSchema.parse({
      isMaximized: window?.isMaximized() ?? false,
    });
    return state;
  });

  // ========================================
  // Filesystem Broker IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): All FS operations via main process only
  // ========================================

  /**
   * Handler for FS_READ_DIRECTORY channel.
   * Reads directory contents with security validation.
   * 
   * @param request - ReadDirectoryRequest with path
   * @returns ReadDirectoryResponse with sorted, filtered entries
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_READ_DIRECTORY,
    async (_event, request: unknown): Promise<ReadDirectoryResponse> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = ReadDirectoryRequestSchema.parse(request);
      return await fsBrokerService.readDirectory(validated.path);
    }
  );

  /**
   * Handler for FS_READ_FILE channel.
   * Reads file contents with security validation.
   * 
   * @param request - ReadFileRequest with path
   * @returns ReadFileResponse with content and encoding
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_READ_FILE,
    async (_event, request: unknown): Promise<ReadFileResponse> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = ReadFileRequestSchema.parse(request);
      return await fsBrokerService.readFile(validated.path);
    }
  );

  /**
   * Handler for FS_WRITE_FILE channel.
   * Writes file contents with security validation.
   *
   * @param request - WriteFileRequest with path and content
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_WRITE_FILE,
    async (_event, request: unknown): Promise<void> => {
      const validated = WriteFileRequestSchema.parse(request);
      await fsBrokerService.writeFile(validated.path, validated.content);
    }
  );

  /**
   * Handler for FS_CREATE_FILE channel.
   * Creates a new file with security validation.
   * 
   * @param request - CreateFileRequest with path and content
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_CREATE_FILE,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = CreateFileRequestSchema.parse(request);
      await fsBrokerService.createFile(validated.path, validated.content);
    }
  );

  /**
   * Handler for FS_CREATE_DIRECTORY channel.
   * Creates a new directory with security validation.
   * 
   * @param request - CreateDirectoryRequest with path
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_CREATE_DIRECTORY,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = CreateDirectoryRequestSchema.parse(request);
      await fsBrokerService.createDirectory(validated.path);
    }
  );

  /**
   * Handler for FS_RENAME channel.
   * Renames a file or directory with security validation.
   * 
   * @param request - RenameRequest with oldPath and newPath
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_RENAME,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = RenameRequestSchema.parse(request);
      await fsBrokerService.rename(validated.oldPath, validated.newPath);
    }
  );

  /**
   * Handler for FS_DELETE channel.
   * Deletes a file or directory (moves to OS trash) with security validation.
   * 
   * @param request - DeleteRequest with path and recursive flag
   * @throws FsError if validation fails or FS operation fails
   */
  ipcMain.handle(
    IPC_CHANNELS.FS_DELETE,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = DeleteRequestSchema.parse(request);
      await fsBrokerService.delete(validated.path);
      // Note: recursive flag in schema but delete() doesn't use it
      // (shell.trashItem handles both files and directories)
    }
  );

  // ========================================
  // Search IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): Search runs in main process only
  // ========================================

  /**
   * Handler for SEARCH_QUERY channel.
   * Executes workspace search via SearchService.
   */
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_QUERY,
    async (_event, request: unknown): Promise<SearchResponse> => {
      const validated = SearchRequestSchema.parse(request);
      return await searchService.search(validated);
    }
  );

  /**
   * Handler for SEARCH_REPLACE channel.
   * Executes replace operation via SearchService.
   */
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_REPLACE,
    async (_event, request: unknown): Promise<ReplaceResponse> => {
      const validated = ReplaceRequestSchema.parse(request);
      return await searchService.replace(validated);
    }
  );

  // ========================================
  // SCM IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): Git commands run in main process only
  // P3 (Secrets): No remote operations or credentials logged
  // ========================================

  /**
   * Handler for SCM_STATUS channel.
   * Retrieves Git status via GitService.
   */
  ipcMain.handle(
    IPC_CHANNELS.SCM_STATUS,
    async (_event, request: unknown): Promise<ScmStatusResponse> => {
      ScmStatusRequestSchema.parse(request ?? {});
      return await gitService.getStatus();
    }
  );

  /**
   * Handler for SCM_STAGE channel.
   * Stages files or all changes.
   */
  ipcMain.handle(
    IPC_CHANNELS.SCM_STAGE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ScmStageRequestSchema.parse(request);
      await gitService.stage(validated);
    }
  );

  /**
   * Handler for SCM_UNSTAGE channel.
   * Unstages files or all changes.
   */
  ipcMain.handle(
    IPC_CHANNELS.SCM_UNSTAGE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ScmUnstageRequestSchema.parse(request);
      await gitService.unstage(validated);
    }
  );

  /**
   * Handler for SCM_COMMIT channel.
   * Commits staged changes with a message.
   */
  ipcMain.handle(
    IPC_CHANNELS.SCM_COMMIT,
    async (_event, request: unknown): Promise<ScmCommitResponse> => {
      const validated = ScmCommitRequestSchema.parse(request);
      return await gitService.commit(validated);
    }
  );

  // ========================================
  // Terminal IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): All PTY operations via main process only
  // P3 (Secrets): Terminal I/O never logged
  // ========================================

  /**
   * Handler for TERMINAL_CREATE channel.
   * Creates a new terminal session (PTY).
   * 
   * @param request - CreateTerminalRequest with cwd, env, shell, cols, rows
   * @returns CreateTerminalResponse with session metadata
   * @throws Error if max sessions exceeded or cwd outside workspace
   */
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_event, request: unknown): Promise<CreateTerminalResponse> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = CreateTerminalRequestSchema.parse(request);
      
      // Get current workspace for security validation
      const workspace = workspaceService.getWorkspace();
      const workspaceRoot = workspace?.path || null;
      
      // Create terminal session via TerminalService
      const session = terminalService.createSession(validated, workspaceRoot);
      
      return { session };
    }
  );

  /**
   * Handler for TERMINAL_WRITE channel.
   * Writes data to a terminal session.
   * 
   * @param request - TerminalWriteRequest with sessionId and data
   * @throws Error if session not found
   */
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WRITE,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = TerminalWriteRequestSchema.parse(request);
      terminalService.write(validated.sessionId, validated.data);
    }
  );

  /**
   * Handler for TERMINAL_RESIZE channel.
   * Resizes a terminal session.
   * 
   * @param request - TerminalResizeRequest with sessionId, cols, rows
   * @throws Error if session not found
   */
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_RESIZE,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = TerminalResizeRequestSchema.parse(request);
      terminalService.resize(validated.sessionId, validated.cols, validated.rows);
    }
  );

  /**
   * Handler for TERMINAL_CLOSE channel.
   * Closes a terminal session.
   * 
   * @param request - TerminalCloseRequest with sessionId
   * @throws Error if session not found
   */
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CLOSE,
    async (_event, request: unknown): Promise<void> => {
      // P6 (Contracts-first): Validate request with Zod schema
      const validated = TerminalCloseRequestSchema.parse(request);
      terminalService.close(validated.sessionId);
    }
  );

  /**
   * Handler for TERMINAL_LIST channel.
   * Lists all active terminal sessions.
   * 
   * @returns ListTerminalsResponse with sessions array
   */
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_LIST,
    async (): Promise<ListTerminalsResponse> => {
      const sessions = terminalService.listSessions();
      return { sessions };
    }
  );

  // ========================================
  // Output IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): All output operations via main process only
  // ========================================

  /**
   * Handler for OUTPUT_APPEND channel.
   * Appends lines to an output channel.
   */
  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_APPEND,
    async (_event, request: unknown): Promise<void> => {
      const validated = AppendOutputRequestSchema.parse(request);
      outputService.append(validated);
    }
  );

  /**
   * Handler for OUTPUT_CLEAR channel.
   * Clears an output channel.
   */
  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_CLEAR,
    async (_event, request: unknown): Promise<void> => {
      const validated = ClearOutputRequestSchema.parse(request);
      outputService.clear(validated);
    }
  );

  /**
   * Handler for OUTPUT_LIST_CHANNELS channel.
   * Lists all output channels.
   */
  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_LIST_CHANNELS,
    async (_event, request: unknown): Promise<any> => {
      ListOutputChannelsRequestSchema.parse(request ?? {});
      return outputService.listChannels();
    }
  );

  /**
   * Handler for OUTPUT_READ channel.
   * Reads lines from an output channel.
   */
  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_READ,
    async (_event, request: unknown): Promise<any> => {
      const validated = ReadOutputRequestSchema.parse(request);
      return outputService.read(validated);
    }
  );

  // ========================================
  // SDD IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): SDD runs in main process only
  // ========================================

  ipcMain.handle(
    IPC_CHANNELS.SDD_LIST_FEATURES,
    async (_event, request: unknown): Promise<SddListFeaturesResponse> => {
      SddListFeaturesRequestSchema.parse(request ?? {});
      return await listSddFeatures();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_STATUS,
    async (_event, request: unknown): Promise<SddStatus> => {
      SddStatusRequestSchema.parse(request ?? {});
      return await sddTraceService.getStatus();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_START_RUN,
    async (_event, request: unknown): Promise<SddRun> => {
      const validated = SddStartRunRequestSchema.parse(request);
      return await sddTraceService.startRun(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_STOP_RUN,
    async (_event, request: unknown): Promise<void> => {
      SddStopRunRequestSchema.parse(request ?? {});
      await sddTraceService.stopRun();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_SET_ACTIVE_TASK,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddSetActiveTaskRequestSchema.parse(request);
      sddTraceService.setActiveTask(validated.featureId, validated.taskId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_GET_FILE_TRACE,
    async (_event, request: unknown): Promise<SddFileTraceResponse> => {
      const validated = SddGetFileTraceRequestSchema.parse(request);
      return await sddTraceService.getFileTrace(validated.path);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_GET_TASK_TRACE,
    async (_event, request: unknown): Promise<SddTaskTraceResponse> => {
      const validated = SddGetTaskTraceRequestSchema.parse(request);
      return await sddTraceService.getTaskTrace(validated.featureId, validated.taskId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_GET_PARITY,
    async (_event, request: unknown): Promise<SddParity> => {
      SddGetParityRequestSchema.parse(request ?? {});
      return await sddTraceService.getParity();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_OVERRIDE_UNTRACKED,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddOverrideUntrackedRequestSchema.parse(request);
      await sddTraceService.overrideUntracked(validated.reason);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_RUNS_START,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddRunStartRequestSchema.parse(request);
      sddRunCoordinator.attachAgentHost(getAgentHostManager());
      await sddRunCoordinator.startRun(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_RUNS_CONTROL,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddRunControlRequestSchema.parse(request);
      sddRunCoordinator.attachAgentHost(getAgentHostManager());
      await sddRunCoordinator.controlRun(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_PROPOSAL_APPLY,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddProposalApplyRequestSchema.parse(request);
      const workspace = workspaceService.getWorkspace();
      if (!workspace) {
        throw new Error('No workspace open. Open a folder first.');
      }

      try {
        const result = await patchApplyService.applyProposal(
          validated.proposal,
          workspace.path
        );
        auditService.logSddProposalApply({
          runId: validated.runId,
          status: 'success',
          filesChanged: result.summary.filesChanged,
          files: result.files,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply proposal';
        auditService.logSddProposalApply({
          runId: validated.runId,
          status: 'error',
          filesChanged: 0,
          error: message,
        });
        throw error;
      }
    }
  );

  // ========================================
  // Connections + Secrets IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): Secret storage via main process only
  // P3 (Secrets): Never log secret values
  // ========================================

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST,
    async (): Promise<ListProvidersResponse> => {
      return { providers: connectionProviderRegistry.list() };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_LIST,
    async (): Promise<ListConnectionsResponse> => {
      const connections = connectionsService.listConnections();
      return { connections };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_CREATE,
    async (_event, request: unknown): Promise<CreateConnectionResponse> => {
      const validated = CreateConnectionRequestSchema.parse(request);
      const connection = connectionsService.createConnection(validated);
      return { connection };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_UPDATE,
    async (_event, request: unknown): Promise<UpdateConnectionResponse> => {
      const validated = UpdateConnectionRequestSchema.parse(request);
      const connection = connectionsService.updateConnection(validated);
      return { connection };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_DELETE,
    async (_event, request: unknown): Promise<void> => {
      const validated = DeleteConnectionRequestSchema.parse(request);
      connectionsService.deleteConnection(validated.id);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_SET_SECRET,
    async (_event, request: unknown): Promise<SetSecretResponse> => {
      const validated = SetSecretRequestSchema.parse(request);
      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === validated.connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${validated.connectionId}`);
      }

      const secretRef = secretsService.setSecret(validated.connectionId, validated.secretValue);
      connectionsService.setSecretRef(validated.connectionId, secretRef);
      return { secretRef };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_REPLACE_SECRET,
    async (_event, request: unknown): Promise<ReplaceSecretResponse> => {
      const validated = ReplaceSecretRequestSchema.parse(request);
      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === validated.connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${validated.connectionId}`);
      }

      const secretRef = secretsService.replaceSecret(validated.connectionId, validated.secretValue);
      connectionsService.setSecretRef(validated.connectionId, secretRef);
      return { secretRef };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_REQUEST_SECRET_ACCESS,
    async (_event, request: unknown): Promise<SecretAccessResponse> => {
      const validated = SecretAccessRequestSchema.parse(request);
      if (validated.decision) {
        consentService.recordDecision(
          validated.connectionId,
          validated.requesterId,
          validated.decision
        );
      }
      const decision = consentService.evaluateAccess(
        validated.connectionId,
        validated.requesterId
      );

      if (decision === null) {
        auditService.logSecretAccess({
          connectionId: validated.connectionId,
          requesterId: validated.requesterId,
          reason: validated.reason,
          allowed: false,
        });
        return { granted: false };
      }

      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === validated.connectionId);

      const secretRef = decision ? connection?.metadata.secretRef : undefined;
      const granted = Boolean(decision && secretRef);

      auditService.logSecretAccess({
        connectionId: validated.connectionId,
        requesterId: validated.requesterId,
        reason: validated.reason,
        allowed: granted,
      });

      return {
        granted,
        secretRef: granted ? secretRef : undefined,
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_AUDIT_LIST,
    async (_event, request: unknown): Promise<ListAuditEventsResponse> => {
      const validated = ListAuditEventsRequestSchema.parse(request ?? {});
      return auditService.listEvents(validated);
    }
  );

}
