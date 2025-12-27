import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FsBrokerService } from './FsBrokerService';
import { WorkspaceService } from './WorkspaceService';
import { shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron
vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/app/path'),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      rename: vi.fn(),
      realpath: vi.fn(),
      stat: vi.fn(),
      access: vi.fn(),
    },
  };
});

describe('FsBrokerService', () => {
  let service: FsBrokerService;
  let workspaceService: WorkspaceService;
  const mockWorkspacePath = path.resolve('/mock/workspace');

  beforeEach(() => {
    // Reset singleton instances
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (FsBrokerService as any).instance = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (WorkspaceService as any).instance = null;

    // Setup workspace
    workspaceService = WorkspaceService.getInstance();
    vi.spyOn(workspaceService, 'getWorkspace').mockReturnValue({
      path: mockWorkspacePath,
      name: 'workspace',
    });

    service = FsBrokerService.getInstance();

    // Clear all mocks
    vi.clearAllMocks();
    vi.mocked(fs.promises.realpath).mockImplementation(async (value: fs.PathLike) => value.toString());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FsBrokerService.getInstance();
      const instance2 = FsBrokerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('readDirectory', () => {
    it('should read directory contents', async () => {
      // Mock readdir
      const mockDirents = [
        { name: 'folder1', isDirectory: () => true, isFile: () => false },
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.promises.readdir).mockResolvedValue(mockDirents as any);

      // Mock stat for file sizes
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 1024 } as fs.Stats);

      const result = await service.readDirectory('./src');

      expect(result.entries).toHaveLength(3);
      expect(fs.promises.readdir).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'src'),
        { withFileTypes: true }
      );
    });

    it('should sort folders first, then files alphabetically', async () => {
      // Mock readdir with mixed order
      const mockDirents = [
        { name: 'zebra.txt', isDirectory: () => false, isFile: () => true },
        { name: 'alpha-folder', isDirectory: () => true, isFile: () => false },
        { name: 'beta.txt', isDirectory: () => false, isFile: () => true },
        { name: 'zulu-folder', isDirectory: () => true, isFile: () => false },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.promises.readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 100 } as fs.Stats);

      const result = await service.readDirectory('./');

      // Check sorting: folders first (alpha, zulu), then files (beta, zebra)
      expect(result.entries[0].name).toBe('alpha-folder');
      expect(result.entries[0].type).toBe('directory');
      expect(result.entries[1].name).toBe('zulu-folder');
      expect(result.entries[1].type).toBe('directory');
      expect(result.entries[2].name).toBe('beta.txt');
      expect(result.entries[2].type).toBe('file');
      expect(result.entries[3].name).toBe('zebra.txt');
      expect(result.entries[3].type).toBe('file');
    });

    it('should include dotfiles and dotfolders', async () => {
      // Mock readdir with dotfiles
      const mockDirents = [
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: '.env', isDirectory: () => false, isFile: () => true },
        { name: 'visible.txt', isDirectory: () => false, isFile: () => true },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.promises.readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 100 } as fs.Stats);

      const result = await service.readDirectory('./');

      expect(result.entries).toHaveLength(3);
      expect(result.entries.map((entry) => entry.name)).toEqual(
        expect.arrayContaining(['.git', '.env', 'visible.txt'])
      );
    });

    it('should include file sizes', async () => {
      const mockDirents = [
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.promises.readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 2048 } as fs.Stats);

      const result = await service.readDirectory('./');

      expect(result.entries[0].size).toBe(2048);
    });

    it('should handle stat errors gracefully (no size)', async () => {
      const mockDirents = [
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.promises.readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('EACCES'));

      const result = await service.readDirectory('./');

      // File should still be included, but without size
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].size).toBeUndefined();
    });

    it('should throw ENOENT error for non-existent directory', async () => {
      const error = new Error('Directory not found') as Error & { code: string };
      error.code = 'ENOENT';
      vi.mocked(fs.promises.readdir).mockRejectedValue(error);

      await expect(service.readDirectory('./nonexistent')).rejects.toMatchObject({
        code: 'ENOENT',
        message: expect.stringContaining('File not found'),
      });
    });
  });

  describe('readFile', () => {
    it('should read file contents', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('file content');

      const result = await service.readFile('./file.txt');

      expect(result.content).toBe('file content');
      expect(result.encoding).toBe('utf-8');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'file.txt'),
        'utf-8'
      );
    });

    it('should throw ENOENT error for non-existent file', async () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      await expect(service.readFile('./nonexistent.txt')).rejects.toMatchObject({
        code: 'ENOENT',
        message: expect.stringContaining('File not found'),
      });
    });
  });

  describe('createFile', () => {
    it('should create file with content', async () => {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await service.createFile('./new-file.txt', 'initial content');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'new-file.txt'),
        'initial content',
        'utf-8'
      );
    });

    it('should create empty file when no content provided', async () => {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await service.createFile('./empty.txt');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'empty.txt'),
        '',
        'utf-8'
      );
    });

    it('should reject invalid filename with null byte', async () => {
      await expect(service.createFile('./invalid\0.txt')).rejects.toMatchObject({
        code: 'INVALID_FILENAME',
        message: expect.stringContaining('null bytes'),
      });
    });

    it('should reject invalid filename with control characters', async () => {
      await expect(service.createFile('./invalid\x01.txt')).rejects.toMatchObject({
        code: 'INVALID_FILENAME',
        message: expect.stringContaining('control characters'),
      });
    });

    it('should accept valid nested path', async () => {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      // This is valid - creating a file in a subdirectory
      await service.createFile('./sub/dir/file.txt', 'content');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'sub/dir/file.txt'),
        'content',
        'utf-8'
      );
    });

    it('should reject filename exceeding 255 characters', async () => {
      const longName = 'a'.repeat(256) + '.txt';
      await expect(service.createFile(`./${longName}`)).rejects.toMatchObject({
        code: 'INVALID_FILENAME',
        message: expect.stringContaining('too long'),
      });
    });

    it('should handle filename with special Windows restrictions', async () => {
      // On Windows, colons are invalid in filenames (except drive letter)
      if (process.platform === 'win32') {
        await expect(service.createFile('./file:name.txt')).rejects.toMatchObject({
          code: 'INVALID_FILENAME',
          message: expect.stringContaining('path separators'),
        });
      } else {
        // On Unix, colons are valid in filenames
        vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
        await expect(service.createFile('./file:name.txt')).resolves.toBeUndefined();
      }
    });
  });

  describe('createDirectory', () => {
    it('should create directory recursively', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      await service.createDirectory('./new-folder/sub-folder');

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'new-folder/sub-folder'),
        { recursive: true }
      );
    });

    it('should reject invalid directory name', async () => {
      await expect(service.createDirectory('./invalid\0-dir')).rejects.toMatchObject({
        code: 'INVALID_FILENAME',
        message: expect.stringContaining('null bytes'),
      });
    });
  });

  describe('rename', () => {
    it('should rename file or directory', async () => {
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await service.rename('./old-name.txt', './new-name.txt');

      expect(fs.promises.rename).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'old-name.txt'),
        path.join(mockWorkspacePath, 'new-name.txt')
      );
    });

    it('should reject invalid new filename', async () => {
      await expect(service.rename('./old.txt', './invalid\0.txt')).rejects.toMatchObject({
        code: 'INVALID_FILENAME',
        message: expect.stringContaining('null bytes'),
      });
    });

    it('should throw ENOENT error for non-existent source', async () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';
      vi.mocked(fs.promises.rename).mockRejectedValue(error);

      await expect(service.rename('./nonexistent.txt', './new.txt')).rejects.toMatchObject({
        code: 'ENOENT',
        message: expect.stringContaining('File not found'),
      });
    });
  });

  describe('delete', () => {
    it('should move file to trash', async () => {
      vi.mocked(shell.trashItem).mockResolvedValue();

      await service.delete('./file-to-delete.txt');

      expect(shell.trashItem).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'file-to-delete.txt')
      );
    });

    it('should throw error for non-existent file', async () => {
      vi.mocked(shell.trashItem).mockRejectedValue(new Error('File not found'));

      await expect(service.delete('./nonexistent.txt')).rejects.toMatchObject({
        code: 'UNKNOWN',
        message: expect.stringContaining('File system error'),
      });
    });
  });

  describe('Path validation (CRITICAL security tests)', () => {
    it('should reject path with .. attempting to escape workspace', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('content');

      await expect(service.readFile('../../../etc/passwd')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
        message: expect.stringContaining('outside workspace'),
      });
    });

    it('should reject absolute path outside workspace', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('content');

      await expect(service.readFile('/etc/passwd')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
        message: expect.stringContaining('outside workspace'),
      });
    });

    it('should reject path with .. in the middle', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('content');

      await expect(service.readFile('./src/../../etc/passwd')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
        message: expect.stringContaining('outside workspace'),
      });
    });

    it('should accept valid relative path within workspace', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('content');

      const result = await service.readFile('./src/file.txt');

      expect(result.content).toBe('content');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        path.join(mockWorkspacePath, 'src/file.txt'),
        'utf-8'
      );
    });

    it('should accept absolute path within workspace', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('content');

      const absolutePath = path.join(mockWorkspacePath, 'src/file.txt');
      const result = await service.readFile(absolutePath);

      expect(result.content).toBe('content');
      expect(fs.promises.readFile).toHaveBeenCalledWith(absolutePath, 'utf-8');
    });

    it('should reject path when no workspace is open', async () => {
      // Mock no workspace
      vi.spyOn(workspaceService, 'getWorkspace').mockReturnValue(null);

      await expect(service.readFile('./file.txt')).rejects.toMatchObject({
        code: 'NO_WORKSPACE',
        message: expect.stringContaining('No workspace open'),
      });
    });

    it('should validate path for all operations (readDirectory)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.promises.readdir).mockResolvedValue([] as any);

      await expect(service.readDirectory('../../../etc')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
      });
    });

    it('should validate path for all operations (createFile)', async () => {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await expect(service.createFile('../../../tmp/evil.txt')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
      });
    });

    it('should validate path for all operations (createDirectory)', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      await expect(service.createDirectory('../../../tmp/evil')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
      });
    });

    it('should validate both paths for rename', async () => {
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      // Test old path validation
      await expect(service.rename('../../../etc/passwd', './new.txt')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
      });

      // Test new path validation
      await expect(service.rename('./old.txt', '../../../tmp/new.txt')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
      });
    });

    it('should validate path for delete', async () => {
      vi.mocked(shell.trashItem).mockResolvedValue();

      await expect(service.delete('../../../etc/passwd')).rejects.toMatchObject({
        code: 'SECURITY_VIOLATION',
      });
    });
  });

  describe('Error mapping', () => {
    it('should map EACCES to permission denied', async () => {
      const error = new Error('Permission denied') as Error & { code: string };
      error.code = 'EACCES';
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      await expect(service.readFile('./file.txt')).rejects.toMatchObject({
        code: 'EACCES',
        message: expect.stringContaining('Permission denied'),
      });
    });

    it('should map EISDIR to path is directory', async () => {
      const error = new Error('Is a directory') as Error & { code: string };
      error.code = 'EISDIR';
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      await expect(service.readFile('./folder')).rejects.toMatchObject({
        code: 'EISDIR',
        message: expect.stringContaining('Path is a directory'),
      });
    });

    it('should map ENOTDIR to path is not directory', async () => {
      const error = new Error('Not a directory') as Error & { code: string };
      error.code = 'ENOTDIR';
      vi.mocked(fs.promises.readdir).mockRejectedValue(error);

      await expect(service.readDirectory('./file.txt')).rejects.toMatchObject({
        code: 'ENOTDIR',
        message: expect.stringContaining('Path is not a directory'),
      });
    });

    it('should map EEXIST to file already exists', async () => {
      const error = new Error('File exists') as Error & { code: string };
      error.code = 'EEXIST';
      vi.mocked(fs.promises.writeFile).mockRejectedValue(error);

      await expect(service.createFile('./existing.txt')).rejects.toMatchObject({
        code: 'EEXIST',
        message: expect.stringContaining('File already exists'),
      });
    });

    it('should map unknown errors', async () => {
      const error = new Error('Unknown error');
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      await expect(service.readFile('./file.txt')).rejects.toMatchObject({
        code: 'UNKNOWN',
        message: expect.stringContaining('File system error'),
      });
    });

    it('should sanitize paths in error messages', async () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      // Test with relative path
      await expect(service.readFile('./nested/file.txt')).rejects.toMatchObject({
        message: expect.stringContaining('nested/file.txt'),
      });
    });
  });
});
