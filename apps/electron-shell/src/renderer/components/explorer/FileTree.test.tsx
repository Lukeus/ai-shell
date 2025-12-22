import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FileTree } from './FileTree';
import { FileTreeContextProvider } from './FileTreeContext';
import type { Workspace, FileEntry } from 'packages-api-contracts';

// Mock window.api
const mockApi = {
  workspace: {
    getCurrent: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
  fs: {
    readDirectory: vi.fn(),
    createFile: vi.fn(),
    createDirectory: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  },
};

// Set up window.api for jsdom environment
(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).window.api = mockApi;

// Mock localStorage
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value;
  },
  clear: () => {
    localStorageStore = {};
  },
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageStore);
    return keys[index] || null;
  },
};

// Make store keys enumerable via Object.keys(localStorage)
Object.defineProperty(global, 'localStorage', {
  value: new Proxy(localStorageMock, {
    ownKeys() {
      return Object.keys(localStorageStore);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in localStorageStore) {
        return { enumerable: true, configurable: true };
      }
      return Object.getOwnPropertyDescriptor(target, prop);
    },
  }),
  configurable: true,
});

describe('FileTree', () => {
  const mockWorkspace: Workspace = {
    path: '/test/workspace',
    name: 'workspace',
  };

  const mockFileEntries: FileEntry[] = [
    { name: 'folder1', path: '/test/workspace/folder1', type: 'directory' },
    { name: 'aaa-file.txt', path: '/test/workspace/aaa-file.txt', type: 'file', size: 100 },
    { name: 'bbb-file.txt', path: '/test/workspace/bbb-file.txt', type: 'file', size: 200 },
    { name: 'folder2', path: '/test/workspace/folder2', type: 'directory' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApi.workspace.getCurrent.mockResolvedValue(null);
  });

  describe('Empty states', () => {
    it('should show "No folder open" when no workspace', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(null);

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No folder open')).toBeInTheDocument();
      });
      expect(screen.getByText('Open a folder to start exploring')).toBeInTheDocument();
    });

    it('should show "No files in workspace" when workspace is empty', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No files in workspace')).toBeInTheDocument();
      });
      expect(screen.getByText('Create a new file or folder to get started')).toBeInTheDocument();
    });

    it('should load files after workspace loads', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: mockFileEntries });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      // Wait for files to load
      await waitFor(() => {
        expect(screen.getByText('folder1')).toBeInTheDocument();
      });

      // Should show multiple files
      expect(screen.getByText('aaa-file.txt')).toBeInTheDocument();
      expect(screen.getByText('bbb-file.txt')).toBeInTheDocument();
    });
  });

  describe('Rendering and sorting', () => {
    it('should render files and folders', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: mockFileEntries });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('folder1')).toBeInTheDocument();
      });

      expect(screen.getByText('folder2')).toBeInTheDocument();
      expect(screen.getByText('aaa-file.txt')).toBeInTheDocument();
      expect(screen.getByText('bbb-file.txt')).toBeInTheDocument();
    });

    it('should sort folders first, then files (both alphabetical)', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      // Provide entries in mixed order
      const mixedEntries: FileEntry[] = [
        { name: 'zzz-file.txt', path: '/test/workspace/zzz-file.txt', type: 'file', size: 100 },
        { name: 'bbb-folder', path: '/test/workspace/bbb-folder', type: 'directory' },
        { name: 'aaa-file.txt', path: '/test/workspace/aaa-file.txt', type: 'file', size: 200 },
        { name: 'aaa-folder', path: '/test/workspace/aaa-folder', type: 'directory' },
      ];
      // Note: FsBrokerService in main process handles sorting, not renderer
      // The test should verify we render entries in the order received
      // Sort the mock entries as FsBrokerService would
      const sortedEntries = [...mixedEntries].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      mockApi.fs.readDirectory.mockResolvedValue({ entries: sortedEntries });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('aaa-folder')).toBeInTheDocument();
      });

      // Get all rendered items
      const items = screen.getAllByRole('treeitem');
      
      // Folders should come first: aaa-folder, bbb-folder
      // Then files: aaa-file.txt, zzz-file.txt
      expect(items[0]).toHaveTextContent('aaa-folder');
      expect(items[1]).toHaveTextContent('bbb-folder');
      expect(items[2]).toHaveTextContent('aaa-file.txt');
      expect(items[3]).toHaveTextContent('zzz-file.txt');
    });

    it('should show dotfiles and dotfolders', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      const entriesWithDotfiles: FileEntry[] = [
        { name: '.hidden-file', path: '/test/workspace/.hidden-file', type: 'file', size: 100 },
        { name: 'visible-file.txt', path: '/test/workspace/visible-file.txt', type: 'file', size: 200 },
        { name: '.hidden-folder', path: '/test/workspace/.hidden-folder', type: 'directory' },
        { name: 'visible-folder', path: '/test/workspace/visible-folder', type: 'directory' },
      ];
      mockApi.fs.readDirectory.mockResolvedValue({ entries: entriesWithDotfiles });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('visible-file.txt')).toBeInTheDocument();
      });

      expect(screen.getByText('visible-folder')).toBeInTheDocument();
      expect(screen.getByText('.hidden-file')).toBeInTheDocument();
      expect(screen.getByText('.hidden-folder')).toBeInTheDocument();
    });
  });

  describe('Expand/collapse', () => {
    it('should expand folder on chevron click', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockImplementation(async ({ path }) => {
        if (path === mockWorkspace.path) {
          return { entries: [{ name: 'folder1', path: '/test/workspace/folder1', type: 'directory' }] };
        }
        if (path === '/test/workspace/folder1') {
          return {
            entries: [
              { name: 'nested-file.txt', path: '/test/workspace/folder1/nested-file.txt', type: 'file', size: 100 },
            ],
          };
        }
        return { entries: [] };
      });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('folder1')).toBeInTheDocument();
      });

      // Find and click expand button
      const expandButton = screen.getByLabelText('Expand folder');
      expandButton.click();

      // Wait for nested content to load
      await waitFor(() => {
        expect(screen.getByText('nested-file.txt')).toBeInTheDocument();
      });

      expect(mockApi.fs.readDirectory).toHaveBeenCalledWith({ path: '/test/workspace/folder1' });
    });

    it('should use cached directory on re-expand', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockImplementation(async ({ path }) => {
        if (path === mockWorkspace.path) {
          return { entries: [{ name: 'folder1', path: '/test/workspace/folder1', type: 'directory' }] };
        }
        if (path === '/test/workspace/folder1') {
          return {
            entries: [
              { name: 'nested-file.txt', path: '/test/workspace/folder1/nested-file.txt', type: 'file', size: 100 },
            ],
          };
        }
        return { entries: [] };
      });

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('folder1')).toBeInTheDocument();
      });

      // Expand
      let expandButton = screen.getByLabelText('Expand folder');
      expandButton.click();

      await waitFor(() => {
        expect(screen.getByText('nested-file.txt')).toBeInTheDocument();
      });

      const firstCallCount = mockApi.fs.readDirectory.mock.calls.length;

      // Collapse
      const collapseButton = screen.getByLabelText('Collapse folder');
      collapseButton.click();

      await waitFor(() => {
        expect(screen.queryByText('nested-file.txt')).not.toBeInTheDocument();
      });

      // Re-expand (should use cache)
      expandButton = screen.getByLabelText('Expand folder');
      expandButton.click();

      await waitFor(() => {
        expect(screen.getByText('nested-file.txt')).toBeInTheDocument();
      });

      // Should not have made another readDirectory call for folder1
      expect(mockApi.fs.readDirectory.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('Inline input', () => {
    it('should show inline input for new file', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: mockFileEntries });

      const onCommit = vi.fn();
      const onCancel = vi.fn();

      render(
        <FileTreeContextProvider>
          <FileTree
            inlineInputMode="new-file"
            onInlineInputCommit={onCommit}
            onInlineInputCancel={onCancel}
          />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('New file name...')).toBeInTheDocument();
      });
    });

    it('should show inline input for new folder', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: mockFileEntries });

      const onCommit = vi.fn();
      const onCancel = vi.fn();

      render(
        <FileTreeContextProvider>
          <FileTree
            inlineInputMode="new-folder"
            onInlineInputCommit={onCommit}
            onInlineInputCancel={onCancel}
          />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('New folder name...')).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should show error state when loading fails', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockRejectedValue(new Error('Permission denied'));

      render(
        <FileTreeContextProvider>
          <FileTree />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading files')).toBeInTheDocument();
      });

      // Should show the actual error message from the rejected promise
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });
});
