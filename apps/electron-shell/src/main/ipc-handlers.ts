import { ipcMain, app } from 'electron';
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
} from 'packages-api-contracts';
import { settingsService } from './services/SettingsService';
import { workspaceService } from './services/WorkspaceService';
import { fsBrokerService } from './services/FsBrokerService';
import { terminalService } from './services/TerminalService';

/**
 * Register all IPC handlers for main process.
 * P6 (Contracts-first): Uses IPC_CHANNELS from api-contracts
 * P1 (Process isolation): Main process owns OS access
 */
export function registerIPCHandlers(): void {
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
      return settingsService.updateSettings(updates);
    }
  );

  // Handler for RESET_SETTINGS channel
  // Resets all settings to defaults
  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async (): Promise<Settings> => {
    return settingsService.resetSettings();
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
}
