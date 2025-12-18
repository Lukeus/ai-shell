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
} as const;

/**
 * Union type of all valid IPC channel names.
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
