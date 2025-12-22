import { shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileEntry,
  ReadDirectoryResponse,
  ReadFileResponse,
  FsError,
} from 'packages-api-contracts';
import { WorkspaceService } from './WorkspaceService';
import {
  resolvePathWithinWorkspace,
  type WorkspacePathOptions,
  WorkspacePathError,
} from './workspace-paths';

/**
 * FsBrokerService - Stateless filesystem broker with critical security validation.
 * 
 * ALL filesystem operations are scoped to the workspace root.
 * Every operation calls validatePathWithinWorkspace() BEFORE accessing disk (CRITICAL security invariant).
 * 
 * Security: This service runs ONLY in the main process. The renderer accesses filesystem
 * exclusively via IPC (window.api.fs.*), maintaining process isolation (P1).
 * 
 * @remarks
 * - Path validation: CRITICAL - rejects `..`, absolute paths outside workspace
 * - Filename validation: rejects null bytes, control chars, path separators
 * - Error mapping: ENOENT → "File not found", EACCES → "Permission denied"
 * - Error sanitization: replaces absolute paths with relative paths in error messages
 * - No secrets: Only handles file/folder paths and content (P3)
 */
export class FsBrokerService {
  private static instance: FsBrokerService | null = null;
  private readonly workspaceService: WorkspaceService;

  /**
   * Private constructor enforces singleton pattern.
   * 
   * @remarks
   * Use FsBrokerService.getInstance() to access the service.
   */
  private constructor() {
    this.workspaceService = WorkspaceService.getInstance();
  }

  /**
   * Get the singleton instance of FsBrokerService.
   * 
   * @returns The singleton FsBrokerService instance
   */
  public static getInstance(): FsBrokerService {
    if (!FsBrokerService.instance) {
      FsBrokerService.instance = new FsBrokerService();
    }
    return FsBrokerService.instance;
  }

  /**
   * Read directory contents.
   * 
   * Returns entries sorted: folders first (alphabetical), then files (alphabetical).
   * Dotfiles and dotfolders are included.
   * 
   * @param requestPath - Path to directory (absolute or relative to workspace root)
   * @returns ReadDirectoryResponse with sorted, filtered entries
   * @throws FsError if path is outside workspace, not found, or permission denied
   */
  public async readDirectory(requestPath: string): Promise<ReadDirectoryResponse> {
    try {
      // CRITICAL: Validate path before disk access
      const validatedPath = await this.validatePathWithinWorkspace(requestPath, {
        requireExisting: true,
      });

      // Read directory with file types
      const dirents = await fs.promises.readdir(validatedPath, { withFileTypes: true });

      const entries: FileEntry[] = await Promise.all(
        dirents.map(async (dirent) => {
          const entryPath = path.join(validatedPath, dirent.name);
          const entry: FileEntry = {
            name: dirent.name,
            path: entryPath,
            type: dirent.isDirectory() ? 'directory' : 'file',
          };

          // Add size for files
          if (dirent.isFile()) {
            try {
              const stats = await fs.promises.stat(entryPath);
              entry.size = stats.size;
            } catch {
              // Ignore stat errors, size is optional
            }
          }

          return entry;
        })
      );

      // Sort: folders first (alphabetical), then files (alphabetical)
      entries.sort((a, b) => {
        // Folders before files
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        // Same type: alphabetical by name (case-insensitive)
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      return { entries };
    } catch (error) {
      throw this.mapErrorToFsError(error, requestPath);
    }
  }

  /**
   * Read file contents.
   * 
   * @param requestPath - Path to file (absolute or relative to workspace root)
   * @returns ReadFileResponse with content and encoding
   * @throws FsError if path is outside workspace, not found, or permission denied
   */
  public async readFile(requestPath: string): Promise<ReadFileResponse> {
    try {
      // CRITICAL: Validate path before disk access
      const validatedPath = await this.validatePathWithinWorkspace(requestPath, {
        requireExisting: true,
      });

      // Read file as UTF-8
      const content = await fs.promises.readFile(validatedPath, 'utf-8');

      return { content, encoding: 'utf-8' };
    } catch (error) {
      throw this.mapErrorToFsError(error, requestPath);
    }
  }

  /**
   * Write file contents.
   *
   * @param requestPath - Path to file (absolute or relative to workspace root)
   * @param content - File content to write
   * @throws FsError if path is outside workspace or write fails
   */
  public async writeFile(requestPath: string, content: string): Promise<void> {
    try {
      const validatedPath = await this.validatePathWithinWorkspace(requestPath, {
        requireExisting: false,
      });
      await fs.promises.writeFile(validatedPath, content, 'utf-8');
    } catch (error) {
      throw this.mapErrorToFsError(error, requestPath);
    }
  }

  /**
   * Create a new file.
   * 
   * @param requestPath - Path to new file (absolute or relative to workspace root)
   * @param content - Initial file content
   * @throws FsError if path is outside workspace, filename invalid, or write fails
   */
  public async createFile(requestPath: string, content: string = ''): Promise<void> {
    try {
      // CRITICAL: Validate path before disk access
      const validatedPath = await this.validatePathWithinWorkspace(requestPath, {
        requireExisting: false,
      });

      // Validate filename
      const filename = path.basename(validatedPath);
      this.validateFilename(filename);

      // Create file
      await fs.promises.writeFile(validatedPath, content, 'utf-8');
    } catch (error) {
      throw this.mapErrorToFsError(error, requestPath);
    }
  }

  /**
   * Create a new directory.
   * 
   * Creates directory recursively (parent directories created if needed).
   * 
   * @param requestPath - Path to new directory (absolute or relative to workspace root)
   * @throws FsError if path is outside workspace, name invalid, or creation fails
   */
  public async createDirectory(requestPath: string): Promise<void> {
    try {
      // CRITICAL: Validate path before disk access
      const validatedPath = await this.validatePathWithinWorkspace(requestPath, {
        requireExisting: false,
      });

      // Validate directory name
      const dirname = path.basename(validatedPath);
      this.validateFilename(dirname);

      // Create directory recursively
      await fs.promises.mkdir(validatedPath, { recursive: true });
    } catch (error) {
      throw this.mapErrorToFsError(error, requestPath);
    }
  }

  /**
   * Rename a file or directory.
   * 
   * @param oldPath - Current path (absolute or relative to workspace root)
   * @param newPath - New path (absolute or relative to workspace root)
   * @throws FsError if paths are outside workspace, not found, or rename fails
   */
  public async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      // CRITICAL: Validate both paths before disk access
      const validatedOldPath = await this.validatePathWithinWorkspace(oldPath, {
        requireExisting: true,
      });
      const validatedNewPath = await this.validatePathWithinWorkspace(newPath, {
        requireExisting: false,
      });

      // Validate new filename
      const newFilename = path.basename(validatedNewPath);
      this.validateFilename(newFilename);

      // Rename
      await fs.promises.rename(validatedOldPath, validatedNewPath);
    } catch (error) {
      throw this.mapErrorToFsError(error, oldPath);
    }
  }

  /**
   * Delete a file or directory.
   * 
   * Uses OS trash/recycle bin (shell.trashItem) for safety.
   * Does NOT permanently delete files.
   * 
   * @param requestPath - Path to delete (absolute or relative to workspace root)
   * @throws FsError if path is outside workspace, not found, or trash fails
   */
  public async delete(requestPath: string): Promise<void> {
    try {
      // CRITICAL: Validate path before disk access
      const validatedPath = await this.validatePathWithinWorkspace(requestPath, {
        requireExisting: true,
      });

      // Move to OS trash (safer than permanent delete)
      await shell.trashItem(validatedPath);
    } catch (error) {
      throw this.mapErrorToFsError(error, requestPath);
    }
  }

  /**
   * Validate path is within workspace root.
   * 
   * CRITICAL SECURITY INVARIANT: This method MUST be called before EVERY disk access.
   * 
   * @param requestPath - Path to validate (absolute or relative to workspace root)
   * @returns Validated absolute path within workspace
   * @throws FsError with code 'SECURITY_VIOLATION' if path is outside workspace
   * 
   * @remarks
   * Validation steps:
   * 1. Resolve path to absolute (relative to workspace root)
   * 2. Normalize to remove `..`, `.`, redundant separators
   * 3. Check starts with workspace root
   * 4. Reject if validation fails
   */
  private async validatePathWithinWorkspace(
    requestPath: string,
    options: WorkspacePathOptions = {}
  ): Promise<string> {
    // Get current workspace
    const workspace = this.workspaceService.getWorkspace();
    if (!workspace) {
      const error: FsError = {
        code: 'NO_WORKSPACE',
        message: 'No workspace open. Open a folder first.',
      };
      throw error;
    }

    try {
      return await resolvePathWithinWorkspace(requestPath, workspace.path, options);
    } catch (error) {
      if (error instanceof WorkspacePathError) {
        const fsError: FsError = {
          code: error.code,
          message: error.message,
        };
        throw fsError;
      }
      throw error;
    }
  }

  /**
   * Validate filename.
   * 
   * Rejects:
   * - Null bytes (\0)
   * - Control characters (ASCII 0-31)
   * - Path separators (/, \, : on Windows)
   * - Names exceeding 255 characters
   * 
   * @param filename - Filename to validate
   * @throws FsError with code 'INVALID_FILENAME' if validation fails
   */
  private validateFilename(filename: string): void {
    // Check length
    if (filename.length === 0) {
      const error: FsError = {
        code: 'INVALID_FILENAME',
        message: 'Filename cannot be empty.',
      };
      throw error;
    }

    if (filename.length > 255) {
      const error: FsError = {
        code: 'INVALID_FILENAME',
        message: 'Filename too long (max 255 characters).',
      };
      throw error;
    }

    // Check for null bytes
    if (filename.includes('\0')) {
      const error: FsError = {
        code: 'INVALID_FILENAME',
        message: 'Filename cannot contain null bytes.',
      };
      throw error;
    }

    // Check for control characters (ASCII 0-31)
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1F]/.test(filename)) {
      const error: FsError = {
        code: 'INVALID_FILENAME',
        message: 'Filename cannot contain control characters.',
      };
      throw error;
    }

    // Check for path separators
    if (filename.includes('/') || filename.includes('\\') || (process.platform === 'win32' && filename.includes(':'))) {
      const error: FsError = {
        code: 'INVALID_FILENAME',
        message: 'Filename cannot contain path separators.',
      };
      throw error;
    }
  }

  /**
   * Map Node.js error to FsError.
   * 
   * Maps error codes to user-friendly messages.
   * Sanitizes paths in error messages (replaces absolute with relative).
   * 
   * @param error - Error from Node.js fs operation
   * @param requestPath - Original request path (for context)
   * @returns FsError with code and message
   */
  private mapErrorToFsError(error: unknown, requestPath: string): FsError {
    // Handle FsError passthrough (already mapped)
    if (this.isFsError(error)) {
      return error;
    }

    // Handle Node.js errors
    if (error instanceof Error) {
      const nodeError = error as Error & { code?: string };

      // Map common error codes
      switch (nodeError.code) {
        case 'ENOENT':
          return {
            code: 'ENOENT',
            message: `File not found: ${this.sanitizePath(requestPath)}`,
          };
        case 'EACCES':
        case 'EPERM':
          return {
            code: 'EACCES',
            message: `Permission denied: ${this.sanitizePath(requestPath)}. Check file permissions.`,
          };
        case 'EISDIR':
          return {
            code: 'EISDIR',
            message: `Path is a directory: ${this.sanitizePath(requestPath)}`,
          };
        case 'ENOTDIR':
          return {
            code: 'ENOTDIR',
            message: `Path is not a directory: ${this.sanitizePath(requestPath)}`,
          };
        case 'EEXIST':
          return {
            code: 'EEXIST',
            message: `File already exists: ${this.sanitizePath(requestPath)}`,
          };
        default:
          return {
            code: nodeError.code || 'UNKNOWN',
            message: `File system error: ${nodeError.message}`,
          };
      }
    }

    // Unknown error
    return {
      code: 'UNKNOWN',
      message: `Unknown error: ${String(error)}`,
    };
  }

  /**
   * Sanitize path in error messages.
   * 
   * Replaces absolute paths with relative paths from workspace root.
   * Prevents leaking sensitive path information.
   * 
   * @param requestPath - Path to sanitize
   * @returns Sanitized path (relative to workspace if possible)
   */
  private sanitizePath(requestPath: string): string {
    const workspace = this.workspaceService.getWorkspace();
    if (!workspace) {
      return path.basename(requestPath);
    }

    // If path is absolute and within workspace, make it relative
    if (path.isAbsolute(requestPath)) {
      const relativePath = path.relative(workspace.path, requestPath);
      // If relative path goes outside workspace (starts with ..), just use basename
      if (relativePath.startsWith('..')) {
        return path.basename(requestPath);
      }
      return relativePath;
    }

    return requestPath;
  }

  /**
   * Type guard for FsError.
   * 
   * @param error - Error to check
   * @returns True if error is FsError
   */
  private isFsError(error: unknown): error is FsError {
    return (
      typeof error === 'object' &&
      error !== null &&
      !(error instanceof Error) && // Exclude Error objects
      'code' in error &&
      'message' in error &&
      typeof (error as FsError).code === 'string' &&
      typeof (error as FsError).message === 'string'
    );
  }
}

/**
 * Singleton instance accessor for convenience.
 * 
 * @example
 * ```typescript
 * import { fsBrokerService } from './services/FsBrokerService';
 * const response = await fsBrokerService.readDirectory('./src');
 * ```
 */
export const fsBrokerService = FsBrokerService.getInstance();
