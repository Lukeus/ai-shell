import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Workspace, WorkspaceSchema } from 'packages-api-contracts';

/**
 * WorkspaceService - Singleton service for managing workspace state and persistence.
 * 
 * This service owns all workspace file I/O operations and ensures workspace data is
 * validated with Zod before being persisted. Workspace is stored in the userData
 * directory as workspace.json with pretty-printed formatting.
 * 
 * Security: This service runs ONLY in the main process. The renderer accesses workspace
 * exclusively via IPC (window.api.workspace.*), maintaining process isolation (P1).
 * 
 * @remarks
 * - Storage: app.getPath('userData')/workspace.json
 * - Format: Pretty-printed JSON (2-space indent)
 * - Validation: All reads/writes validated with WorkspaceSchema (Zod)
 * - Error handling: Corrupted files or deleted paths return null, never block app launch
 * - No secrets: workspace.json contains only path + name (P3)
 */
export class WorkspaceService {
  private static instance: WorkspaceService | null = null;
  private readonly workspacePath: string;
  private cachedWorkspace: Workspace | null = null;

  /**
   * Private constructor enforces singleton pattern.
   * 
   * @remarks
   * Use WorkspaceService.getInstance() to access the service.
   */
  private constructor() {
    this.workspacePath = path.join(app.getPath('userData'), 'workspace.json');
  }

  /**
   * Get the singleton instance of WorkspaceService.
   * 
   * @returns The singleton WorkspaceService instance
   */
  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  /**
   * Get the current workspace.
   * 
   * Reads workspace from cache or disk, validates with Zod, and returns the Workspace
   * object. If the file is corrupted or the path no longer exists, returns null
   * and cleans up the corrupted file.
   * 
   * @returns Current Workspace object, or null if no workspace open or path no longer exists
   * 
   * @example
   * ```typescript
   * const workspace = workspaceService.getWorkspace();
   * if (workspace) {
   *   console.log(workspace.name); // 'my-project'
   * }
   * ```
   */
  public getWorkspace(): Workspace | null {
    // Return cached workspace if available
    if (this.cachedWorkspace) {
      // Validate path still exists
      if (!fs.existsSync(this.cachedWorkspace.path)) {
        console.warn(
          `Workspace path no longer exists: ${this.cachedWorkspace.path}. Clearing workspace.`
        );
        this.clearWorkspace();
        return null;
      }
      return this.cachedWorkspace;
    }

    // Try to load from disk
    try {
      // Check if workspace.json exists
      if (!fs.existsSync(this.workspacePath)) {
        return null;
      }

      // Read workspace file
      const fileContent = fs.readFileSync(this.workspacePath, 'utf-8');
      const parsed = JSON.parse(fileContent);

      // Validate with Zod
      const validated = WorkspaceSchema.parse(parsed);

      // Validate path still exists
      if (!fs.existsSync(validated.path)) {
        console.warn(
          `Workspace path no longer exists: ${validated.path}. Clearing workspace.`
        );
        this.clearWorkspace();
        return null;
      }

      this.cachedWorkspace = validated;
      return validated;
    } catch (error) {
      // Corrupted file: log warning, delete file, return null
      console.warn(
        'Workspace file corrupted or invalid, clearing:',
        error instanceof Error ? error.message : String(error)
      );

      // Delete corrupted file (best effort, don't throw)
      try {
        if (fs.existsSync(this.workspacePath)) {
          fs.unlinkSync(this.workspacePath);
        }
      } catch (deleteError) {
        console.error(
          'Failed to delete corrupted workspace file:',
          deleteError instanceof Error ? deleteError.message : String(deleteError)
        );
      }

      this.cachedWorkspace = null;
      return null;
    }
  }

  /**
   * Set the workspace to the specified folder path.
   * 
   * Validates that the path exists and is a directory, creates a Workspace object,
   * and persists to workspace.json.
   * 
   * @param folderPath - Absolute path to the workspace folder
   * @returns Workspace object if successful, null if path invalid
   * @throws Error if disk write fails after retry
   * 
   * @example
   * ```typescript
   * const workspace = workspaceService.setWorkspace('/Users/alice/projects/my-app');
   * console.log(workspace?.name); // 'my-app'
   * ```
   */
  public setWorkspace(folderPath: string): Workspace | null {
    // Validate path exists and is a directory
    try {
      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        console.warn(`Path is not a directory: ${folderPath}`);
        return null;
      }
    } catch (error) {
      console.warn(
        `Path does not exist or is not accessible: ${folderPath}`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }

    // Create workspace object
    const workspace: Workspace = {
      path: folderPath,
      name: path.basename(folderPath),
    };

    // Validate with Zod
    const validated = WorkspaceSchema.parse(workspace);

    // Persist to disk
    this.saveWorkspaceToDisk(validated);

    // Update cache
    this.cachedWorkspace = validated;

    return validated;
  }

  /**
   * Clear the current workspace.
   * 
   * Removes workspace.json file and clears the cache.
   * Does not throw if file doesn't exist.
   * 
   * @example
   * ```typescript
   * workspaceService.clearWorkspace();
   * const workspace = workspaceService.getWorkspace(); // null
   * ```
   */
  public clearWorkspace(): void {
    // Clear cache
    this.cachedWorkspace = null;

    // Delete workspace.json (best effort, don't throw)
    try {
      if (fs.existsSync(this.workspacePath)) {
        fs.unlinkSync(this.workspacePath);
      }
    } catch (error) {
      console.error(
        'Failed to delete workspace file:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Open native folder picker dialog and set workspace.
   * 
   * Opens Electron dialog.showOpenDialog with 'openDirectory' property.
   * If user selects a folder, validates and sets it as workspace.
   * If user cancels, returns null.
   * 
   * @returns Workspace object if folder selected, null if cancelled
   * 
   * @example
   * ```typescript
   * const workspace = await workspaceService.openWorkspace();
   * if (workspace) {
   *   console.log(`Opened workspace: ${workspace.name}`);
   * }
   * ```
   */
  public async openWorkspace(): Promise<Workspace | null> {
    // Open native folder picker dialog
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Folder',
      buttonLabel: 'Open',
    });

    // User cancelled
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    // Get selected folder path
    const selectedPath = result.filePaths[0];

    // Set workspace and return
    return this.setWorkspace(selectedPath);
  }

  /**
   * Save workspace to disk with retry logic.
   * 
   * Writes workspace to workspace.json with pretty-printing (2-space indent).
   * If the write fails, retries once after 100ms. Throws if both attempts fail.
   * 
   * @param workspace - Workspace object to persist
   * @throws Error if write fails after retry
   * 
   * @remarks
   * This is a private method used by setWorkspace().
   * Write failures are rare (disk full, permissions issue).
   */
  private saveWorkspaceToDisk(workspace: Workspace): void {
    const json = JSON.stringify(workspace, null, 2);

    try {
      // Ensure directory exists
      const dir = path.dirname(this.workspacePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to disk
      fs.writeFileSync(this.workspacePath, json, 'utf-8');
    } catch (error) {
      // Write failed, retry once after 100ms
      console.error(
        'Workspace write failed, retrying...',
        error instanceof Error ? error.message : String(error)
      );

      // Wait 100ms
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait (main process, acceptable for 100ms)
      }

      try {
        // Retry write
        fs.writeFileSync(this.workspacePath, json, 'utf-8');
      } catch (retryError) {
        // Both attempts failed, throw error
        console.error(
          'Workspace write retry failed:',
          retryError instanceof Error ? retryError.message : String(retryError)
        );
        throw new Error(
          `Failed to persist workspace to disk: ${
            retryError instanceof Error ? retryError.message : String(retryError)
          }`
        );
      }
    }
  }
}

/**
 * Singleton instance accessor for convenience.
 * 
 * @example
 * ```typescript
 * import { workspaceService } from './services/WorkspaceService';
 * const workspace = workspaceService.getWorkspace();
 * ```
 */
export const workspaceService = WorkspaceService.getInstance();
