import type { AppInfo } from './types/app-info';
import type { Settings, PartialSettings } from './types/settings';
import type { Workspace } from './types/workspace';
import type {
  ReadDirectoryRequest,
  ReadDirectoryResponse,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  CreateFileRequest,
  CreateDirectoryRequest,
  RenameRequest,
  DeleteRequest,
} from './types/fs-broker';
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalWriteRequest,
  TerminalResizeRequest,
  TerminalCloseRequest,
  ListTerminalsResponse,
  TerminalDataEvent,
  TerminalExitEvent,
} from './types/terminal';
import type {
  AppendOutputRequest,
  ClearOutputRequest,
  ListOutputChannelsResponse,
  ReadOutputRequest,
  ReadOutputResponse,
  OutputAppendEvent,
  OutputClearEvent,
} from './types/output';
import type {
  PublishDiagnosticsRequest,
  ClearDiagnosticsRequest,
  ListDiagnosticsRequest,
  ListDiagnosticsResponse,
  DiagnosticsUpdateEvent,
  DiagnosticsSummaryEvent,
} from './types/diagnostics';
import type {
  AgentRunStartRequest,
  AgentRunStartResponse,
  AgentRunControlRequest,
  AgentRunControlResponse,
  ListAgentRunsResponse,
  GetAgentRunRequest,
  GetAgentRunResponse,
} from './types/agent-runs';
import type {
  AgentEvent,
  AgentEventSubscriptionRequest,
  ListAgentTraceRequest,
  ListAgentTraceResponse,
} from './types/agent-events';
import type {
  CreateConnectionRequest,
  CreateConnectionResponse,
  UpdateConnectionRequest,
  UpdateConnectionResponse,
  DeleteConnectionRequest,
  ListConnectionsResponse,
} from './types/connections';
import type {
  SetSecretRequest,
  SetSecretResponse,
  ReplaceSecretRequest,
  ReplaceSecretResponse,
  SecretAccessRequest,
  SecretAccessResponse,
} from './types/secrets';
import type {
  ListAuditEventsRequest,
  ListAuditEventsResponse,
} from './types/audit';
import type {
  ExtensionRegistryItem,
  ExtensionIdRequest,
  ListExtensionsResponse,
} from './types/extension-registry';
import type {
  ExtensionStateChangeEvent,
} from './types/extension-events';
import type {
  CommandContribution,
  ViewContribution,
} from './types/extension-contributions';
import type {
  PermissionScope,
  PermissionGrant,
} from './types/extension-permissions';
import type { WindowState } from './types/window-state';

/**
 * Preload API surface exposed to the renderer process via contextBridge.
 * This defines the contract for communication between renderer and main process.
 * 
 * Security: This is the ONLY API the sandboxed renderer can access.
 * All methods must be carefully reviewed to prevent privilege escalation.
 */
export interface PreloadAPI {
  /**
   * Retrieves version information about the application and runtime.
   * @returns Promise resolving to AppInfo object with version details
   */
  getVersion(): Promise<AppInfo>;
  
  /**
   * Retrieves all application settings.
   * 
   * @returns Promise resolving to complete Settings object
   * @throws Error if settings file is corrupted and cannot be recovered
   */
  getSettings(): Promise<Settings>;
  
  /**
   * Updates application settings (partial merge).
   * 
   * Validates with Zod schema before persisting to disk. Only the provided
   * fields are updated; unspecified fields retain their current values.
   * 
   * @param updates - Partial settings object with fields to update
   * @returns Promise resolving to updated complete Settings object
   * @throws Error if validation fails or disk write fails after retry
   * 
   * @example
   * ```typescript
   * // Only update theme, leave other settings unchanged
   * const updated = await window.api.updateSettings({
   *   appearance: { theme: 'light' }
   * });
   * ```
   */
  updateSettings(updates: PartialSettings): Promise<Settings>;
  
  /**
   * Resets all settings to defaults.
   * 
   * Overwrites the settings file with SETTINGS_DEFAULTS.
   * 
   * @returns Promise resolving to default Settings object
   */
  resetSettings(): Promise<Settings>;
  
  /**
   * Workspace management APIs.
   * 
   * Security: All filesystem operations are scoped to the workspace root.
   * Main process validates all paths before accessing disk (P1: Process Isolation).
   */
  workspace: {
    /**
     * Opens native folder picker dialog and sets workspace.
     * 
     * Opens Electron dialog.showOpenDialog with 'openDirectory' property.
     * If user selects a folder, main process validates path exists and is readable,
     * then persists to workspace.json.
     * 
     * @returns Promise resolving to Workspace object if folder selected, null if cancelled
     */
    open(): Promise<Workspace | null>;
    
    /**
     * Gets the current workspace.
     * 
     * Reads from WorkspaceService cache or loads from workspace.json.
     * Validates path still exists; returns null if workspace folder was deleted.
     * 
     * @returns Promise resolving to current Workspace object, or null if no folder open
     */
    getCurrent(): Promise<Workspace | null>;
    
    /**
     * Closes the current workspace.
     * 
     * Clears workspace in WorkspaceService and deletes workspace.json file.
     * 
     * @returns Promise resolving when workspace is closed
     */
    close(): Promise<void>;
  };
  
  /**
   * File system broker APIs (workspace-scoped only).
   * 
   * Security: ALL operations are scoped to workspace root.
   * Main process validates paths with validatePathWithinWorkspace() before EVERY disk access.
   * Attempts to access paths outside workspace (e.g., '..', absolute paths) are REJECTED.
   */
  fs: {
    /**
     * Reads directory contents.
     * 
     * Returns entries sorted: folders first (alphabetical), then files (alphabetical).
     * Dotfiles (starting with '.') are filtered out.
     * 
     * @param request - Directory path (absolute or relative to workspace root)
     * @returns Promise resolving to ReadDirectoryResponse with sorted entries
     * @throws FsError if path is outside workspace, not found, or permission denied
     */
    readDirectory(request: ReadDirectoryRequest): Promise<ReadDirectoryResponse>;
    
    /**
     * Reads file contents.
     * 
     * @param request - File path (absolute or relative to workspace root)
     * @returns Promise resolving to ReadFileResponse with content and encoding
     * @throws FsError if path is outside workspace, not found, or permission denied
     */
    readFile(request: ReadFileRequest): Promise<ReadFileResponse>;

    /**
     * Writes file contents.
     *
     * @param request - File path and new content
     * @returns Promise resolving when file is written
     * @throws FsError if path is outside workspace or write fails
     */
    writeFile(request: WriteFileRequest): Promise<void>;
    
    /**
     * Creates a new file.
     * 
     * Main process validates filename (rejects null bytes, control chars, path separators).
     * 
     * @param request - File path and initial content
     * @returns Promise resolving when file is created
     * @throws FsError if path is outside workspace, filename invalid, or write fails
     */
    createFile(request: CreateFileRequest): Promise<void>;
    
    /**
     * Creates a new directory.
     * 
     * Creates directory recursively (parent directories created if needed).
     * Main process validates directory name.
     * 
     * @param request - Directory path
     * @returns Promise resolving when directory is created
     * @throws FsError if path is outside workspace, name invalid, or creation fails
     */
    createDirectory(request: CreateDirectoryRequest): Promise<void>;
    
    /**
     * Renames a file or directory.
     * 
     * Main process validates both paths are within workspace.
     * 
     * @param request - Old path and new path
     * @returns Promise resolving when rename completes
     * @throws FsError if paths are outside workspace, not found, or rename fails
     */
    rename(request: RenameRequest): Promise<void>;
    
    /**
     * Deletes a file or directory.
     * 
     * Uses OS trash/recycle bin (shell.trashItem) for safety.
     * Does NOT permanently delete files.
     * 
     * @param request - Path to delete and recursive flag
     * @returns Promise resolving when deletion completes
     * @throws FsError if path is outside workspace, not found, or trash fails
     */
    delete(request: DeleteRequest): Promise<void>;
  };
  
  /**
   * Terminal management APIs (PTY sessions).
   * 
   * Security: PTY operations run ONLY in main process.
   * Terminal I/O is NEVER logged to prevent secrets exposure (P3: Secrets).
   */
  terminal: {
    /**
     * Creates a new terminal session (PTY).
     * 
     * Main process spawns PTY using node-pty with validated cwd within workspace.
     * Environment variables are sanitized to prevent secrets exposure.
     * 
     * @param request - Terminal creation parameters (cwd, env, shell, size)
     * @returns Promise resolving to CreateTerminalResponse with session metadata
     * @throws Error if cwd is outside workspace or max sessions (10) exceeded
     */
    create(request: CreateTerminalRequest): Promise<CreateTerminalResponse>;
    
    /**
     * Writes data to a terminal session.
     * 
     * Sends user input to PTY stdin (e.g., typed characters, control sequences).
     * 
     * @param request - Session ID and data to write
     * @returns Promise resolving when data is written
     * @throws Error if session ID is invalid or session is closed
     */
    write(request: TerminalWriteRequest): Promise<void>;
    
    /**
     * Resizes a terminal session.
     * 
     * Forwards resize to PTY (updates cols/rows).
     * 
     * @param request - Session ID and new dimensions
     * @returns Promise resolving when resize completes
     * @throws Error if session ID is invalid
     */
    resize(request: TerminalResizeRequest): Promise<void>;
    
    /**
     * Closes a terminal session.
     * 
     * Kills PTY process and removes session from active sessions.
     * 
     * @param request - Session ID to close
     * @returns Promise resolving when session is closed
     * @throws Error if session ID is invalid
     */
    close(request: TerminalCloseRequest): Promise<void>;
    
    /**
     * Lists all active terminal sessions.
     * 
     * @returns Promise resolving to ListTerminalsResponse with session metadata
     */
    list(): Promise<ListTerminalsResponse>;
    
    /**
     * Subscribes to terminal data events.
     * 
     * Callback is invoked when PTY outputs data (stdout/stderr).
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when data event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onData(callback: (event: TerminalDataEvent) => void): () => void;
    
    /**
     * Subscribes to terminal exit events.
     * 
     * Callback is invoked when PTY process exits.
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when exit event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onExit(callback: (event: TerminalExitEvent) => void): () => void;
  };
  
  /**
   * Output channel APIs.
   * 
   * Manages named output channels for build logs, extension logs, etc.
   * Supports 10K+ lines with pagination.
   */
  output: {
    /**
     * Appends lines to an output channel.
     * 
     * Creates channel if it doesn't exist. Lines are appended atomically.
     * 
     * @param request - Channel ID, lines to append, optional severity
     * @returns Promise resolving when lines are appended
     */
    append(request: AppendOutputRequest): Promise<void>;
    
    /**
     * Clears an output channel.
     * 
     * Removes all lines from the channel; channel metadata is preserved.
     * 
     * @param request - Channel ID to clear
     * @returns Promise resolving when channel is cleared
     * @throws Error if channel ID is invalid
     */
    clear(request: ClearOutputRequest): Promise<void>;
    
    /**
     * Lists all output channels.
     * 
     * @returns Promise resolving to ListOutputChannelsResponse with channel metadata
     */
    listChannels(): Promise<ListOutputChannelsResponse>;
    
    /**
     * Reads lines from an output channel.
     * 
     * Supports pagination for large channels (10K+ lines).
     * 
     * @param request - Channel ID, start line, max lines
     * @returns Promise resolving to ReadOutputResponse with lines and pagination info
     * @throws Error if channel ID is invalid
     */
    read(request: ReadOutputRequest): Promise<ReadOutputResponse>;
    
    /**
     * Subscribes to output append events.
     * 
     * Callback is invoked when lines are appended to any channel.
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when append event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onAppend(callback: (event: OutputAppendEvent) => void): () => void;
    
    /**
     * Subscribes to output clear events.
     * 
     * Callback is invoked when a channel is cleared.
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when clear event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onClear(callback: (event: OutputClearEvent) => void): () => void;
  };
  
  /**
   * Diagnostics APIs (problems panel).
   * 
   * Manages diagnostics (errors, warnings, info, hints) from TypeScript, ESLint, etc.
   * Supports 1000+ diagnostics with filtering.
   */
  diagnostics: {
    /**
     * Publishes diagnostics for a file.
     * 
     * Replaces all diagnostics for the file from the given source.
     * If diagnostics array is empty, clears all diagnostics for that file+source.
     * 
     * @param request - File path, source, diagnostics array
     * @returns Promise resolving when diagnostics are published
     */
    publish(request: PublishDiagnosticsRequest): Promise<void>;
    
    /**
     * Clears diagnostics.
     * 
     * Clears diagnostics by file path and/or source.
     * 
     * @param request - Optional file path and/or source filter
     * @returns Promise resolving when diagnostics are cleared
     */
    clear(request: ClearDiagnosticsRequest): Promise<void>;
    
    /**
     * Lists all diagnostics.
     * 
     * Supports filtering by severity and source.
     * 
     * @param request - Optional severity and/or source filter
     * @returns Promise resolving to ListDiagnosticsResponse with diagnostics and summary
     */
    list(request: ListDiagnosticsRequest): Promise<ListDiagnosticsResponse>;
    
    /**
     * Subscribes to diagnostics update events.
     * 
     * Callback is invoked when diagnostics are added, updated, or removed for a file.
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when update event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onUpdate(callback: (event: DiagnosticsUpdateEvent) => void): () => void;
    
    /**
     * Subscribes to diagnostics summary events.
     * 
     * Callback is invoked when overall diagnostics counts change.
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when summary event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onSummary(callback: (event: DiagnosticsSummaryEvent) => void): () => void;
  };

  /**
   * Agent runs + event stream APIs.
   * 
   * Security: renderer receives metadata and events only (no secrets).
   */
  agents: {
    /**
     * Lists all agent runs.
     */
    listRuns(): Promise<ListAgentRunsResponse>;

    /**
     * Gets a single agent run.
     */
    getRun(request: GetAgentRunRequest): Promise<GetAgentRunResponse>;

    /**
     * Starts a new agent run.
     */
    startRun(request: AgentRunStartRequest): Promise<AgentRunStartResponse>;

    /**
     * Cancels an agent run.
     */
    cancelRun(request: AgentRunControlRequest): Promise<AgentRunControlResponse>;

    /**
     * Retries an agent run.
     */
    retryRun(request: AgentRunControlRequest): Promise<AgentRunControlResponse>;

    /**
     * Lists trace events for a run.
     */
    listTrace(request: ListAgentTraceRequest): Promise<ListAgentTraceResponse>;

    /**
     * Subscribes to agent event stream.
     */
    subscribeEvents(request: AgentEventSubscriptionRequest): Promise<void>;

    /**
     * Unsubscribes from agent event stream.
     */
    unsubscribeEvents(request: AgentEventSubscriptionRequest): Promise<void>;

    /**
     * Receives agent events.
     */
    onEvent(callback: (event: AgentEvent) => void): () => void;
  };

  /**
   * Connections + secrets APIs.
   * 
   * Security: secrets are written to main only; renderer never receives plaintext.
   */
  connections: {
    /**
     * Lists all connections.
     */
    list(): Promise<ListConnectionsResponse>;
    
    /**
     * Creates a connection (metadata + non-secret config).
     */
    create(request: CreateConnectionRequest): Promise<CreateConnectionResponse>;
    
    /**
     * Updates a connection (metadata + non-secret config).
     */
    update(request: UpdateConnectionRequest): Promise<UpdateConnectionResponse>;
    
    /**
     * Deletes a connection.
     */
    delete(request: DeleteConnectionRequest): Promise<void>;
    
    /**
     * Sets a secret for a connection.
     */
    setSecret(request: SetSecretRequest): Promise<SetSecretResponse>;
    
    /**
     * Replaces a secret for a connection.
     */
    replaceSecret(request: ReplaceSecretRequest): Promise<ReplaceSecretResponse>;
    
    /**
     * Requests secret access (consent-gated).
     */
    requestSecretAccess(request: SecretAccessRequest): Promise<SecretAccessResponse>;
  };

  /**
   * Audit APIs (read-only).
   */
  audit: {
    /**
     * Lists audit events.
     */
    list(request: ListAuditEventsRequest): Promise<ListAuditEventsResponse>;
  };

  /**
   * Extensions APIs.
   * 
   * Security: renderer can list and execute extension commands,
   * but cannot directly load or execute extension code.
   * All extension operations go through main process (P1: Process Isolation).
   */
  extensions: {
    /**
     * Lists all installed extensions.
     * 
     * @returns Promise resolving to list response with extension items
     */
    list(): Promise<ListExtensionsResponse>;

    /**
     * Gets a specific extension by ID.
     * 
     * @param extensionId - Extension identifier
     * @returns Promise resolving to extension item, or null if not found
     */
    get(request: ExtensionIdRequest): Promise<ExtensionRegistryItem | null>;

    /**
     * Enables an extension by ID.
     */
    enable(request: ExtensionIdRequest): Promise<void>;

    /**
     * Disables an extension by ID.
     */
    disable(request: ExtensionIdRequest): Promise<void>;

    /**
     * Uninstalls an extension by ID.
     */
    uninstall(request: ExtensionIdRequest): Promise<void>;

    /**
     * Executes an extension command.
     * 
     * Main process routes to Extension Host, which executes the command
     * and returns the result.
     * 
     * @param command - Command identifier (e.g., "extension.commandName")
     * @param args - Optional command arguments
     * @returns Promise resolving to command result (type depends on command)
     * @throws Error if command not found, extension not active, or execution fails
     */
    executeCommand(command: string, args?: unknown[]): Promise<unknown>;

    /**
     * Lists all available extension commands.
     * 
     * @returns Promise resolving to array of command contributions
     */
    listCommands(): Promise<CommandContribution[]>;

    /**
     * Lists all extension views.
     * 
     * @returns Promise resolving to array of view contributions
     */
    listViews(): Promise<ViewContribution[]>;

    /**
     * Requests a permission for an extension.
     * 
     * Shows permission consent dialog to user.
     * 
     * @param extensionId - Extension requesting permission
     * @param scope - Permission scope to request
     * @returns Promise resolving to true if granted, false if denied
     */
    requestPermission(extensionId: string, scope: PermissionScope): Promise<boolean>;

    /**
     * Lists all permissions for an extension.
     */
    listPermissions(request: ExtensionIdRequest): Promise<PermissionGrant[]>;

    /**
     * Revokes all permissions for an extension.
     */
    revokePermissions(request: ExtensionIdRequest): Promise<void>;

    /**
     * Subscribes to extension state change events.
     * 
     * Callback is invoked when any extension changes state
     * (e.g., inactive → activating → active).
     * Returns unsubscribe function to clean up listener.
     * 
     * @param callback - Function to call when state change event occurs
     * @returns Unsubscribe function (call to remove listener)
     */
    onStateChange(callback: (event: ExtensionStateChangeEvent) => void): () => void;
  };

  /**
   * Window control APIs (main process only).
   */
  windowControls: {
    /**
     * Minimize the current window.
     */
    minimize(): Promise<void>;

    /**
     * Toggle maximize/restore on the current window.
     */
    toggleMaximize(): Promise<void>;

    /**
     * Close the current window.
     */
    close(): Promise<void>;

    /**
     * Get current window state.
     */
    getState(): Promise<WindowState>;

    /**
     * Subscribe to window state changes.
     */
    onStateChange(callback: (state: WindowState) => void): () => void;
  };
  
  // Future expansion:
  // invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * Global type augmentation for the renderer process.
 * Makes window.api available with full type safety in renderer code.
 */
declare global {
  interface Window {
    api: PreloadAPI;
  }
}
