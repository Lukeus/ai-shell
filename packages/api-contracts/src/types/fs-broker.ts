import { z } from 'zod';

/**
 * File entry type returned by readDirectory operations.
 * 
 * Represents a single file or directory in the workspace.
 */
export const FileEntrySchema = z.object({
  /** File or folder name (basename only) */
  name: z.string(),
  
  /** Absolute path to file/folder */
  path: z.string(),
  
  /** Entry type */
  type: z.enum(['file', 'directory']),
  
  /** File size in bytes (files only, optional for directories) */
  size: z.number().optional(),
});

/**
 * File entry type inferred from FileEntrySchema.
 */
export type FileEntry = z.infer<typeof FileEntrySchema>;

/**
 * Request to read a directory's contents.
 * 
 * Path can be absolute or relative to workspace root.
 * Main process validates path is within workspace before accessing filesystem.
 */
export const ReadDirectoryRequestSchema = z.object({
  /** Path to directory (absolute or relative to workspace root) */
  path: z.string(),
});

/**
 * ReadDirectoryRequest type inferred from schema.
 */
export type ReadDirectoryRequest = z.infer<typeof ReadDirectoryRequestSchema>;

/**
 * Response from readDirectory operation.
 * 
 * Entries are sorted: folders first (alphabetical), then files (alphabetical).
 * Dotfiles (starting with '.') are filtered out.
 */
export const ReadDirectoryResponseSchema = z.object({
  /** Array of file entries (sorted: folders first, then files, both alphabetical) */
  entries: z.array(FileEntrySchema),
});

/**
 * ReadDirectoryResponse type inferred from schema.
 */
export type ReadDirectoryResponse = z.infer<typeof ReadDirectoryResponseSchema>;

/**
 * Request to read a file's contents.
 * 
 * Path can be absolute or relative to workspace root.
 * Main process validates path is within workspace before reading.
 */
export const ReadFileRequestSchema = z.object({
  /** Path to file (absolute or relative to workspace root) */
  path: z.string(),
});

/**
 * ReadFileRequest type inferred from schema.
 */
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;

/**
 * Response from readFile operation.
 * 
 * Content is returned as string with encoding information.
 */
export const ReadFileResponseSchema = z.object({
  /** File content as string */
  content: z.string(),
  
  /** Encoding used to read the file */
  encoding: z.enum(['utf-8', 'binary']),
});

/**
 * ReadFileResponse type inferred from schema.
 */
export type ReadFileResponse = z.infer<typeof ReadFileResponseSchema>;

/**
 * Request to create a new file.
 * 
 * Path can be absolute or relative to workspace root.
 * Main process validates path is within workspace and filename is valid.
 */
export const CreateFileRequestSchema = z.object({
  /** Path to new file (absolute or relative to workspace root) */
  path: z.string(),
  
  /** Initial file content (empty string for empty file) */
  content: z.string().default(''),
});

/**
 * CreateFileRequest type inferred from schema.
 */
export type CreateFileRequest = z.infer<typeof CreateFileRequestSchema>;

/**
 * Request to create a new directory.
 * 
 * Path can be absolute or relative to workspace root.
 * Main process validates path is within workspace and directory name is valid.
 * Created recursively (parent directories created if needed).
 */
export const CreateDirectoryRequestSchema = z.object({
  /** Path to new directory (absolute or relative to workspace root) */
  path: z.string(),
});

/**
 * CreateDirectoryRequest type inferred from schema.
 */
export type CreateDirectoryRequest = z.infer<typeof CreateDirectoryRequestSchema>;

/**
 * Request to rename a file or directory.
 * 
 * Both paths can be absolute or relative to workspace root.
 * Main process validates both paths are within workspace.
 */
export const RenameRequestSchema = z.object({
  /** Current path (absolute or relative to workspace root) */
  oldPath: z.string(),
  
  /** New path (absolute or relative to workspace root) */
  newPath: z.string(),
});

/**
 * RenameRequest type inferred from schema.
 */
export type RenameRequest = z.infer<typeof RenameRequestSchema>;

/**
 * Request to delete a file or directory.
 * 
 * Path can be absolute or relative to workspace root.
 * Main process validates path is within workspace.
 * Deletion uses OS trash/recycle bin (shell.trashItem) for safety.
 */
export const DeleteRequestSchema = z.object({
  /** Path to delete (absolute or relative to workspace root) */
  path: z.string(),
  
  /** If true, delete directories recursively */
  recursive: z.boolean().default(true),
});

/**
 * DeleteRequest type inferred from schema.
 */
export type DeleteRequest = z.infer<typeof DeleteRequestSchema>;

/**
 * Error response for file system operations.
 * 
 * Returned when a filesystem operation fails.
 * Main process maps Node.js error codes to user-friendly messages.
 */
export const FsErrorSchema = z.object({
  /** Error code (e.g., 'ENOENT', 'EACCES', 'EISDIR', 'SECURITY_VIOLATION') */
  code: z.string(),
  
  /** User-friendly error message */
  message: z.string(),
});

/**
 * FsError type inferred from schema.
 */
export type FsError = z.infer<typeof FsErrorSchema>;
