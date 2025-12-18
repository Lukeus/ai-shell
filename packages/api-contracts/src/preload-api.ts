import type { AppInfo } from './types/app-info';
import type { Settings, PartialSettings } from './types/settings';
import type { Workspace } from './types/workspace';
import type {
  ReadDirectoryRequest,
  ReadDirectoryResponse,
  ReadFileRequest,
  ReadFileResponse,
  CreateFileRequest,
  CreateDirectoryRequest,
  RenameRequest,
  DeleteRequest,
} from './types/fs-broker';

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
