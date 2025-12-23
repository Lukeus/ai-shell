import { ipcMain, app, BrowserWindow, type WebContents } from 'electron';
import { randomUUID } from 'crypto';
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
  AgentRunStartRequestSchema,
  AgentRunStartResponse,
  AgentRunControlRequestSchema,
  AgentRunControlResponse,
  ListAgentRunsResponse,
  GetAgentRunRequestSchema,
  GetAgentRunResponse,
  AgentEventSchema,
  AgentEventSubscriptionRequestSchema,
  ListAgentTraceRequestSchema,
  ListAgentTraceResponse,
  type AgentEvent,
  type AgentRunStatus,
  CreateConnectionRequestSchema,
  CreateConnectionResponse,
  UpdateConnectionRequestSchema,
  UpdateConnectionResponse,
  DeleteConnectionRequestSchema,
  ListConnectionsResponse,
  SetSecretRequestSchema,
  SetSecretResponse,
  ReplaceSecretRequestSchema,
  ReplaceSecretResponse,
  SecretAccessRequestSchema,
  SecretAccessResponse,
  ListAuditEventsRequestSchema,
  ListAuditEventsResponse,
  WindowStateSchema,
  ExtensionIdRequestSchema,
  ListExtensionsResponse,
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
} from 'packages-api-contracts';
import { settingsService } from './services/SettingsService';
import { workspaceService } from './services/WorkspaceService';
import { fsBrokerService } from './services/FsBrokerService';
import { terminalService } from './services/TerminalService';
import { searchService } from './services/SearchService';
import { gitService } from './services/GitService';
import { connectionsService } from './services/ConnectionsService';
import { secretsService } from './services/SecretsService';
import { consentService } from './services/ConsentService';
import { auditService } from './services/AuditService';
import { agentRunStore } from './services/AgentRunStore';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';
import { resolvePathWithinWorkspace } from './services/workspace-paths';
import {
  getAgentHostManager,
  getExtensionCommandService,
  getExtensionRegistry,
  getExtensionViewService,
  getExtensionToolService,
  getPermissionService,
} from './index';

type AgentSubscriber = {
  sender: WebContents;
  runId?: string;
};

const agentSubscribers = new Map<number, AgentSubscriber>();

const registerAgentSubscriber = (sender: WebContents, runId?: string): void => {
  const existing = agentSubscribers.get(sender.id);
  agentSubscribers.set(sender.id, { sender, runId });
  if (!existing) {
    sender.once('destroyed', () => {
      agentSubscribers.delete(sender.id);
    });
  }
};

const unregisterAgentSubscriber = (sender: WebContents): void => {
  agentSubscribers.delete(sender.id);
};

const publishAgentEvent = (event: AgentEvent): void => {
  const validated = AgentEventSchema.parse(event);
  for (const subscriber of agentSubscribers.values()) {
    if (subscriber.sender.isDestroyed()) {
      agentSubscribers.delete(subscriber.sender.id);
      continue;
    }
    if (subscriber.runId && subscriber.runId !== validated.runId) {
      continue;
    }
    subscriber.sender.send(IPC_CHANNELS.AGENT_EVENTS_ON_EVENT, validated);
  }
};

const appendAndPublish = (event: AgentEvent): void => {
  if (event.type === 'status') {
    try {
      agentRunStore.updateRunStatus(event.runId, event.status);
    } catch {
      // Ignore missing runs; events may arrive before metadata is created.
    }
  }
  agentRunStore.appendEvent(event);
  publishAgentEvent(event);
};

let agentHostBindingsReady = false;

const ensureAgentHostBindings = (): void => {
  if (agentHostBindingsReady) {
    return;
  }

  const agentHostManager = getAgentHostManager();
  if (!agentHostManager) {
    return;
  }

  agentHostManager.onEvent((event) => {
    appendAndPublish(event);
  });

  agentHostManager.onRunError((runId, message) => {
    appendAndPublish(
      AgentEventSchema.parse({
        id: randomUUID(),
        runId,
        timestamp: new Date().toISOString(),
        type: 'error',
        message,
      })
    );
    try {
      agentRunStore.updateRunStatus(runId, 'failed');
    } catch {
      // Ignore missing runs; failure event is still published.
    }
  });

  agentHostBindingsReady = true;
};

const getWindowFromEvent = (event: Electron.IpcMainInvokeEvent): BrowserWindow | null => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window ?? null;
};

const buildStatusEvent = (runId: string, status: AgentRunStatus): AgentEvent =>
  AgentEventSchema.parse({
    id: randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    type: 'status',
    status,
  });

let sddBindingsReady = false;

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
  ensureAgentHostBindings();
  ensureSddBindings();
  void applySddSettings(settingsService.getSettings());
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

  // ========================================
  // Agent Runs + Events IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): Agent Host/renderer communicate through main
  // ========================================

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_LIST,
    async (): Promise<ListAgentRunsResponse> => {
      const runs = agentRunStore.listRuns();
      return { runs };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_GET,
    async (_event, request: unknown): Promise<GetAgentRunResponse> => {
      const validated = GetAgentRunRequestSchema.parse(request);
      const run = agentRunStore.getRun(validated.runId);
      if (!run) {
        throw new Error(`Agent run not found: ${validated.runId}`);
      }
      return { run };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_START,
    async (_event, request: unknown): Promise<AgentRunStartResponse> => {
      const validated = AgentRunStartRequestSchema.parse(request);
      const run = agentRunStore.createRun('user');
      appendAndPublish(buildStatusEvent(run.id, run.status));

      ensureAgentHostBindings();
      const agentHostManager = getAgentHostManager();

      if (!agentHostManager) {
        appendAndPublish(
          AgentEventSchema.parse({
            id: randomUUID(),
            runId: run.id,
            timestamp: new Date().toISOString(),
            type: 'error',
            message: 'Agent Host not available.',
          })
        );
        return { run };
      }

      try {
        await agentHostManager.startRun(run.id, validated);
        return { run };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start agent run';
        const failedRun = agentRunStore.updateRunStatus(run.id, 'failed');
        appendAndPublish(
          AgentEventSchema.parse({
            id: randomUUID(),
            runId: run.id,
            timestamp: new Date().toISOString(),
            type: 'error',
            message,
          })
        );
        return { run: failedRun };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_CANCEL,
    async (_event, request: unknown): Promise<AgentRunControlResponse> => {
      const validated = AgentRunControlRequestSchema.parse(request);
      const run = agentRunStore.updateRunStatus(validated.runId, 'canceled');
      appendAndPublish(buildStatusEvent(run.id, run.status));
      return { run };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_RETRY,
    async (_event, request: unknown): Promise<AgentRunControlResponse> => {
      const validated = AgentRunControlRequestSchema.parse(request);
      const run = agentRunStore.updateRunStatus(validated.runId, 'queued');
      appendAndPublish(buildStatusEvent(run.id, run.status));
      return { run };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_TRACE_LIST,
    async (_event, request: unknown): Promise<ListAgentTraceResponse> => {
      const validated = ListAgentTraceRequestSchema.parse(request);
      return agentRunStore.listEvents(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_EVENTS_SUBSCRIBE,
    async (event, request: unknown): Promise<void> => {
      const validated = AgentEventSubscriptionRequestSchema.parse(request ?? {});
      if (!event?.sender) {
        return;
      }
      registerAgentSubscriber(event.sender, validated.runId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_EVENTS_UNSUBSCRIBE,
    async (event, request: unknown): Promise<void> => {
      AgentEventSubscriptionRequestSchema.parse(request ?? {});
      if (!event?.sender) {
        return;
      }
      unregisterAgentSubscriber(event.sender);
    }
  );

  // ========================================
  // Connections + Secrets IPC Handlers
  // P6 (Contracts-first): Validate all requests with Zod before processing
  // P1 (Process isolation): Secret storage via main process only
  // P3 (Secrets): Never log secret values
  // ========================================

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

  // ========================================
  // Extension IPC Handlers
  // P1 (Process isolation): Renderer never talks directly to Extension Host
  // P2 (Security): All operations go through main process
  // ========================================

  /**
   * Handler for EXTENSIONS_LIST channel.
   * Lists installed extensions from registry.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_LIST,
    async (): Promise<ListExtensionsResponse> => {
      const registry = getExtensionRegistry();
      if (!registry) {
        return { extensions: [] };
      }

      const extensions = registry.getAllExtensions().map((item) => ({
        manifest: item.manifest,
        enabled: item.enabled,
        installedAt: item.installedAt,
        updatedAt: item.updatedAt,
      }));

      return { extensions };
    }
  );

  /**
   * Handler for EXTENSIONS_GET channel.
   * Gets a single extension by ID.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_GET,
    async (_event, request: unknown) => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        return null;
      }

      const extension = registry.getExtension(validated.extensionId);
      if (!extension) {
        return null;
      }

      return {
        manifest: extension.manifest,
        enabled: extension.enabled,
        installedAt: extension.installedAt,
        updatedAt: extension.updatedAt,
      };
    }
  );

  /**
   * Handler for EXTENSIONS_ENABLE channel.
   * Enables an extension by ID.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_ENABLE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        throw new Error('Extension registry not initialized');
      }

      const ok = await registry.enableExtension(validated.extensionId);
      if (!ok) {
        throw new Error(`Extension not found: ${validated.extensionId}`);
      }
    }
  );

  /**
   * Handler for EXTENSIONS_DISABLE channel.
   * Disables an extension by ID.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_DISABLE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        throw new Error('Extension registry not initialized');
      }

      const ok = await registry.disableExtension(validated.extensionId);
      if (!ok) {
        throw new Error(`Extension not found: ${validated.extensionId}`);
      }
    }
  );

  /**
   * Handler for EXTENSIONS_UNINSTALL channel.
   * Uninstalls an extension by ID.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_UNINSTALL,
    async (_event, request: unknown): Promise<void> => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        throw new Error('Extension registry not initialized');
      }

      const ok = await registry.uninstallExtension(validated.extensionId);
      if (!ok) {
        throw new Error(`Extension not found: ${validated.extensionId}`);
      }
    }
  );

  /**
   * Handler for EXTENSIONS_EXECUTE_COMMAND channel.
   * Executes a command from an extension.
   * 
   * @param commandId - Command ID to execute
   * @param args - Command arguments
   * @returns Command execution result
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND,
    async (_event, commandId: string, args?: unknown[]) => {
      const commandService = getExtensionCommandService();
      if (!commandService) {
        throw new Error('Extension command service not initialized');
      }

      return await commandService.executeCommand(commandId, args);
    }
  );

  /**
   * Handler for EXTENSIONS_LIST_COMMANDS channel.
   * Lists all registered extension commands.
   */
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_LIST_COMMANDS, async () => {
    const commandService = getExtensionCommandService();
    if (!commandService) {
      return [];
    }

    return commandService.listCommands();
  });

  /**
   * Handler for EXTENSIONS_REQUEST_PERMISSION channel.
   * Request a permission for an extension.
   * Returns result if already granted/denied, or null if user decision needed.
   * 
   * P1: Permission checks enforced in main process only
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_REQUEST_PERMISSION,
    async (_event, extensionId: string, scope: string, reason?: string) => {
      const permService = getPermissionService();
      if (!permService) {
        throw new Error('Permission service not initialized');
      }

      const result = await permService.requestPermission(extensionId, scope as any, reason);
      return result;
    }
  );

  /**
   * Handler for EXTENSIONS_LIST_PERMISSIONS channel.
   * List all permissions for an extension.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_LIST_PERMISSIONS,
    async (_event, request: unknown) => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const permService = getPermissionService();
      if (!permService) {
        return [];
      }

      return permService.getAllPermissions(validated.extensionId);
    }
  );

  /**
   * Handler for EXTENSIONS_REVOKE_PERMISSION channel.
   * Revoke a specific permission for an extension.
   * Note: For now, this revokes ALL permissions. Individual revocation in future task.
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_REVOKE_PERMISSION,
    async (_event, request: unknown) => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const permService = getPermissionService();
      if (!permService) {
        throw new Error('Permission service not initialized');
      }

      await permService.revokeAllPermissions(validated.extensionId);
    }
  );

  /**
   * Handler for EXTENSIONS_LIST_VIEWS channel.
   * Lists all registered extension views.
   * Task 8: View contribution points
   */
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_LIST_VIEWS, async () => {
    const viewService = getExtensionViewService();
    if (!viewService) {
      return [];
    }

    return viewService.listViews();
  });

  /**
   * Handler for EXTENSIONS_RENDER_VIEW channel.
   * Renders an extension view and returns content.
   * Task 8: View content sanitized before rendering in renderer (P1)
   */
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_RENDER_VIEW,
    async (_event, viewId: string) => {
      const viewService = getExtensionViewService();
      if (!viewService) {
        throw new Error('Extension view service not initialized');
      }

      return await viewService.renderView(viewId);
    }
  );
}
