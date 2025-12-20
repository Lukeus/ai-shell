/**
 * IPC channel name constants to prevent typos and ensure type safety.
 * These channels define the communication contract between main and renderer processes.
 */
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
  
  // Settings management
  /** Retrieve all application settings */
  GET_SETTINGS: 'settings:get',
  
  /** Update application settings (partial merge) */
  UPDATE_SETTINGS: 'settings:update',
  
  /** Reset all settings to defaults */
  RESET_SETTINGS: 'settings:reset',
  
  // Workspace management
  /** Open native folder picker and set workspace */
  WORKSPACE_OPEN: 'workspace:open',
  
  /** Get current workspace (null if no folder open) */
  WORKSPACE_GET_CURRENT: 'workspace:get-current',
  
  /** Close current workspace */
  WORKSPACE_CLOSE: 'workspace:close',
  
  // File system broker (workspace-scoped)
  /** Read directory contents */
  FS_READ_DIRECTORY: 'fs:read-directory',
  
  /** Read file contents */
  FS_READ_FILE: 'fs:read-file',
  
  /** Create new file */
  FS_CREATE_FILE: 'fs:create-file',
  
  /** Create new directory */
  FS_CREATE_DIRECTORY: 'fs:create-directory',
  
  /** Rename file or directory */
  FS_RENAME: 'fs:rename',
  
  /** Delete file or directory (moves to OS trash) */
  FS_DELETE: 'fs:delete',
  
  // Terminal management (PTY)
  /** Create a new terminal session */
  TERMINAL_CREATE: 'terminal:create',
  
  /** Write data to terminal session */
  TERMINAL_WRITE: 'terminal:write',
  
  /** Resize terminal session */
  TERMINAL_RESIZE: 'terminal:resize',
  
  /** Close terminal session */
  TERMINAL_CLOSE: 'terminal:close',
  
  /** List all active terminal sessions */
  TERMINAL_LIST: 'terminal:list',
  
  /** Terminal data event (main → renderer) */
  TERMINAL_DATA: 'terminal:data',
  
  /** Terminal exit event (main → renderer) */
  TERMINAL_EXIT: 'terminal:exit',
  
  // Output channels
  /** Append lines to output channel */
  OUTPUT_APPEND: 'output:append',
  
  /** Clear output channel */
  OUTPUT_CLEAR: 'output:clear',
  
  /** List all output channels */
  OUTPUT_LIST_CHANNELS: 'output:list-channels',
  
  /** Read lines from output channel */
  OUTPUT_READ: 'output:read',
  
  /** Output append event (main → renderer) */
  OUTPUT_ON_APPEND: 'output:on-append',
  
  /** Output clear event (main → renderer) */
  OUTPUT_ON_CLEAR: 'output:on-clear',
  
  // Diagnostics (problems panel)
  /** Publish diagnostics for a file */
  DIAGNOSTICS_PUBLISH: 'diagnostics:publish',
  
  /** Clear diagnostics */
  DIAGNOSTICS_CLEAR: 'diagnostics:clear',
  
  /** List all diagnostics */
  DIAGNOSTICS_LIST: 'diagnostics:list',
  
  /** Diagnostics update event (main → renderer) */
  DIAGNOSTICS_ON_UPDATE: 'diagnostics:on-update',
  
  /** Diagnostics summary event (main → renderer) */
  DIAGNOSTICS_ON_SUMMARY: 'diagnostics:on-summary',
} as const;

/**
 * Union type of all valid IPC channel names.
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
