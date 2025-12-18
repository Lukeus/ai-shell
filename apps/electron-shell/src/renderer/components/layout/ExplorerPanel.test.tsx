import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ExplorerPanel } from './ExplorerPanel';
import { FileTreeContextProvider } from '../explorer/FileTreeContext';
import type { Workspace } from 'packages-api-contracts';

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

describe('ExplorerPanel', () => {
  const mockWorkspace: Workspace = {
    path: '/test/workspace',
    name: 'test-workspace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApi.workspace.getCurrent.mockResolvedValue(null);
  });

  describe('Empty states', () => {
    it('should show "No folder open" state with Open Folder button', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(null);

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No folder open')).toBeInTheDocument();
      });

      expect(screen.getByText('EXPLORER')).toBeInTheDocument();
      expect(screen.getByText('Open Folder')).toBeInTheDocument();
    });

    it('should show error state with Retry button', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockRejectedValue(new Error('Permission denied'));

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading files')).toBeInTheDocument();
      });

      expect(screen.getByText('Permission denied')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Header actions', () => {
    it('should display workspace name in header', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('test-workspace')).toBeInTheDocument();
      });
    });

    it('should display action buttons when workspace is open', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('New File')).toBeInTheDocument();
      expect(screen.getByLabelText('New Folder')).toBeInTheDocument();
      expect(screen.getByLabelText('Collapse All')).toBeInTheDocument();
    });

    it('should have refresh button that can be clicked', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
      });

      const refreshButton = screen.getByLabelText('Refresh');
      
      // Should not be disabled initially
      expect(refreshButton).not.toBeDisabled();
      
      // Click should work without errors
      refreshButton.click();
    });
  });

  describe('Inline input flow', () => {
    it('should show inline input for new file on New File button click', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('New File')).toBeInTheDocument();
      });

      const newFileButton = screen.getByLabelText('New File');
      newFileButton.click();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('New file name...')).toBeInTheDocument();
      });
    });

    it('should show inline input for new folder on New Folder button click', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('New Folder')).toBeInTheDocument();
      });

      const newFolderButton = screen.getByLabelText('New Folder');
      newFolderButton.click();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('New folder name...')).toBeInTheDocument();
      });
    });
  });

  describe('FileTree integration', () => {
    it('should render FileTree component when workspace is open', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({
        entries: [
          { name: 'test-file.txt', path: '/test/workspace/test-file.txt', type: 'file', size: 100 },
        ],
      });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });
    });

    it('should show "No files in workspace" when workspace is empty', async () => {
      mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
      mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });

      render(
        <FileTreeContextProvider>
          <ExplorerPanel />
        </FileTreeContextProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No files in workspace')).toBeInTheDocument();
      });
    });
  });
});
