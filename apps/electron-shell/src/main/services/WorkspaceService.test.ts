import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceService } from './WorkspaceService';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn(),
}));

// Import mocked modules
import { dialog } from 'electron';

describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;
  const mockUserDataPath = 'C:\\mock\\userdata';
  const mockWorkspacePath = path.join(mockUserDataPath, 'workspace.json');
  const mockFolderPath = 'C:\\mock\\projects\\my-project';

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset the singleton instance using reflection
    // @ts-expect-error Accessing private static field for testing
    WorkspaceService.instance = null;
    
    // Get fresh instance
    workspaceService = WorkspaceService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance()', () => {
    it('should return singleton instance', () => {
      // Act
      const first = WorkspaceService.getInstance();
      const second = WorkspaceService.getInstance();

      // Assert
      expect(first).toBe(second);
    });
  });

  describe('getWorkspace()', () => {
    it('should return null when no workspace is set', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Act
      const result = workspaceService.getWorkspace();

      // Assert
      expect(result).toBeNull();
    });

    it('should read file, parse JSON, validate with Zod, and return Workspace', () => {
      // Arrange
      const mockWorkspace = {
        path: mockFolderPath,
        name: 'my-project',
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkspace));

      // Act
      const result = workspaceService.getWorkspace();

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith(mockWorkspacePath, 'utf-8');
      expect(result).toEqual(mockWorkspace);
      expect(result?.name).toBe('my-project');
      expect(result?.path).toBe(mockFolderPath);
    });

    it('should return cached workspace on subsequent calls', () => {
      // Arrange
      const mockWorkspace = {
        path: mockFolderPath,
        name: 'my-project',
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkspace));

      // Act
      const first = workspaceService.getWorkspace();
      const second = workspaceService.getWorkspace();

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Only called once
      expect(first).toBe(second); // Same object reference (cached)
    });

    it('should return null and clear workspace when file is corrupted', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{invalid json}');
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      // Act
      const result = workspaceService.getWorkspace();

      // Assert
      expect(result).toBeNull();
      // Verify it attempted to delete corrupted file
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockWorkspacePath);
    });

    it('should return null when workspace path no longer exists on disk', () => {
      // Arrange
      const mockWorkspace = {
        path: mockFolderPath,
        name: 'my-project',
      };
      // Mock that workspace.json exists and can be read
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path === mockWorkspacePath) return true;
        if (path === mockFolderPath) return false; // Folder deleted
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkspace));
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      // Act
      const result = workspaceService.getWorkspace();

      // Assert
      expect(result).toBeNull();
      // Verify it cleared workspace
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockWorkspacePath);
    });

    it('should return null when Zod validation fails', () => {
      // Arrange - missing required field 'name'
      const invalidWorkspace = {
        path: mockFolderPath,
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidWorkspace));
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      // Act
      const result = workspaceService.getWorkspace();

      // Assert
      expect(result).toBeNull();
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockWorkspacePath);
    });
  });

  describe('setWorkspace()', () => {
    it('should validate path exists, create Workspace, persist to disk, and return Workspace', () => {
      // Arrange
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Act
      const result = workspaceService.setWorkspace(mockFolderPath);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.path).toBe(mockFolderPath);
      expect(result?.name).toBe('my-project');
      
      // Verify persistence
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(writeCall[0]).toBe(mockWorkspacePath);
      expect(writeCall[1]).toContain('"path"');
      expect(writeCall[1]).toContain('my-project');
      expect(writeCall[2]).toBe('utf-8');
    });

    it('should return null when path does not exist', () => {
      // Arrange
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      // Act
      const result = workspaceService.setWorkspace('C:\\nonexistent\\path');

      // Assert
      expect(result).toBeNull();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should return null when path is not a directory', () => {
      // Arrange
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => false,
      } as any);

      // Act
      const result = workspaceService.setWorkspace('C:\\mock\\file.txt');

      // Assert
      expect(result).toBeNull();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should update cache after successful set', () => {
      // Arrange
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path === mockFolderPath) return true;
        return true;
      });
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Act
      workspaceService.setWorkspace(mockFolderPath);
      const result = workspaceService.getWorkspace();

      // Assert
      expect(result?.path).toBe(mockFolderPath);
      // Should not read from disk (cached)
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('clearWorkspace()', () => {
    it('should delete workspace.json file and clear cache', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      // Act
      workspaceService.clearWorkspace();

      // Assert
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockWorkspacePath);
      
      // Verify cache cleared
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = workspaceService.getWorkspace();
      expect(result).toBeNull();
    });

    it('should not throw when workspace.json does not exist', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Act & Assert
      expect(() => workspaceService.clearWorkspace()).not.toThrow();
    });

    it('should not throw when unlinkSync fails', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('EPERM: operation not permitted');
      });

      // Act & Assert
      expect(() => workspaceService.clearWorkspace()).not.toThrow();
    });
  });

  describe('openWorkspace()', () => {
    it('should open native dialog and set workspace when folder selected', async () => {
      // Arrange
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [mockFolderPath],
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Act
      const result = await workspaceService.openWorkspace();

      // Assert
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        title: 'Open Folder',
        buttonLabel: 'Open',
      });
      expect(result).not.toBeNull();
      expect(result?.path).toBe(mockFolderPath);
      expect(result?.name).toBe('my-project');
    });

    it('should return null when user cancels dialog', async () => {
      // Arrange
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      // Act
      const result = await workspaceService.openWorkspace();

      // Assert
      expect(result).toBeNull();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should return null when no folders selected', async () => {
      // Arrange
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [],
      });

      // Act
      const result = await workspaceService.openWorkspace();

      // Assert
      expect(result).toBeNull();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('saveWorkspaceToDisk() - error handling', () => {
    it('should retry once after initial write failure', () => {
      // Arrange
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
      
      // Mock writeFileSync to fail once, then succeed
      let callCount = 0;
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('ENOSPC: no space left on device');
        }
        // Success on retry
      });

      // Act
      const result = workspaceService.setWorkspace(mockFolderPath);

      // Assert
      expect(result).not.toBeNull();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Initial + retry
    });

    it('should throw error when both write attempts fail', () => {
      // Arrange
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      // Act & Assert
      expect(() => workspaceService.setWorkspace(mockFolderPath)).toThrow(
        'Failed to persist workspace to disk'
      );
    });
  });
});
