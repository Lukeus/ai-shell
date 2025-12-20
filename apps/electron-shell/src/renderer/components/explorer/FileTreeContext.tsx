import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { Workspace, FileEntry } from 'packages-api-contracts';

/**
 * FileTreeContext - React context for workspace and file tree state management.
 *
 * P1 (Process isolation): Uses window.api.* for ALL IPC calls (no Node.js access).
 * Renderer state is ephemeral or localStorage only (no disk access).
 *
 * @remarks
 * - Manages workspace state, expanded folders, open tabs, directory cache
 * - Persists expandedFolders and openTabs to localStorage per workspace
 * - Deduplicates file opens: focuses existing tab if already open
 */

/**
 * File tree context value interface.
 */
export interface FileTreeContextValue {
  // Workspace state
  workspace: Workspace | null;
  isLoading: boolean;
  error: string | null;

  // Tree state
  expandedFolders: Set<string>;
  directoryCache: Map<string, FileEntry[]>;

  // Editor tabs
  openTabs: string[];
  activeTabIndex: number;

  // Workspace operations
  loadWorkspace: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  closeWorkspace: () => Promise<void>;

  // Tree operations
  toggleFolder: (path: string) => Promise<void>;
  collapseAll: () => void;
  loadDirectory: (path: string) => Promise<FileEntry[]>;
  refresh: (path?: string) => Promise<void>;

  // File operations
  openFile: (path: string) => void;
  closeTab: (index: number) => void;
  closeOtherTabs: (index: number) => void;
  closeTabsToRight: (index: number) => void;
  setActiveTab: (index: number) => void;
  createFile: (parentPath: string, filename: string, content?: string) => Promise<void>;
  createFolder: (parentPath: string, folderName: string) => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
}

const FileTreeContext = createContext<FileTreeContextValue | null>(null);

/**
 * Hook to access FileTreeContext.
 *
 * @throws Error if used outside FileTreeContextProvider
 */
export function useFileTree(): FileTreeContextValue {
  const context = useContext(FileTreeContext);
  if (!context) {
    throw new Error('useFileTree must be used within FileTreeContextProvider');
  }
  return context;
}

/**
 * Generate stable hash for workspace path (for localStorage keys).
 */
function hashWorkspacePath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * FileTreeContextProvider - Provider component for file tree state.
 */
export function FileTreeContextProvider({ children }: { children: React.ReactNode }) {
  // Workspace state
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tree state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [directoryCache, setDirectoryCache] = useState<Map<string, FileEntry[]>>(new Map());

  // Editor tabs
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(-1);

  // Generate localStorage key for current workspace
  const localStorageKey = useMemo(() => {
    if (!workspace) return null;
    return `fileTree:${hashWorkspacePath(workspace.path)}`;
  }, [workspace]);

  /**
   * Load persisted state from localStorage for current workspace.
   */
  useEffect(() => {
    if (!localStorageKey) return;

    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) {
        const { expandedFolders: expanded, openTabs: tabs } = JSON.parse(stored);
        if (Array.isArray(expanded)) {
          setExpandedFolders(new Set(expanded));
        }
        if (Array.isArray(tabs)) {
          setOpenTabs(tabs);
          if (tabs.length > 0) {
            setActiveTabIndex(0);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load persisted file tree state:', err);
    }
  }, [localStorageKey]);

  /**
   * Persist state to localStorage whenever it changes.
   */
  useEffect(() => {
    if (!localStorageKey) return;

    try {
      const data = {
        expandedFolders: Array.from(expandedFolders),
        openTabs,
      };
      localStorage.setItem(localStorageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to persist file tree state:', err);
    }
  }, [localStorageKey, expandedFolders, openTabs]);

  /**
   * Load current workspace from main process.
   */
  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // P1: Use window.api.* for IPC call
      const currentWorkspace = await window.api.workspace.getCurrent();
      setWorkspace(currentWorkspace);
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to load workspace';
      setError(message);
      console.error('Failed to load workspace:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Open workspace via native dialog.
   */
  const openWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // P1: Use window.api.* for IPC call
      const newWorkspace = await window.api.workspace.open();
      if (newWorkspace) {
        setWorkspace(newWorkspace);
        // Clear state for new workspace
        setExpandedFolders(new Set());
        setDirectoryCache(new Map());
        setOpenTabs([]);
        setActiveTabIndex(-1);
      }
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to open workspace';
      setError(message);
      console.error('Failed to open workspace:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Close current workspace.
   */
  const closeWorkspace = useCallback(async () => {
    try {
      // P1: Use window.api.* for IPC call
      await window.api.workspace.close();
      setWorkspace(null);
      setExpandedFolders(new Set());
      setDirectoryCache(new Map());
      setOpenTabs([]);
      setActiveTabIndex(-1);
      setError(null);
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to close workspace';
      setError(message);
      console.error('Failed to close workspace:', err);
    }
  }, []);

  /**
   * Load directory contents from main process.
   */
  const loadDirectory = useCallback(async (path: string): Promise<FileEntry[]> => {
    try {
      // P1: Use window.api.* for IPC call
      const response = await window.api.fs.readDirectory({ path });
      const entries = response.entries;

      // Update cache
      setDirectoryCache((prev) => {
        const next = new Map(prev);
        next.set(path, entries);
        return next;
      });

      return entries;
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to load directory';
      setError(message);
      console.error('Failed to load directory:', err);
      throw err;
    }
  }, []);

  /**
   * Toggle folder expanded/collapsed state.
   * Lazy-loads directory contents on first expand.
   */
  const toggleFolder = useCallback(
    async (path: string) => {
      const isExpanded = expandedFolders.has(path);

      if (isExpanded) {
        // Collapse
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } else {
        // Expand - load directory if not cached
        if (!directoryCache.has(path)) {
          setIsLoading(true);
          try {
            await loadDirectory(path);
          } finally {
            setIsLoading(false);
          }
        }

        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
      }
    },
    [expandedFolders, directoryCache, loadDirectory]
  );

  /**
   * Collapse all folders.
   */
  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  /**
   * Refresh directory contents (or entire tree if no path specified).
   */
  const refresh = useCallback(
    async (path?: string) => {
      if (path) {
        // Refresh specific directory
        try {
          await loadDirectory(path);
        } catch {
          // Error already handled in loadDirectory
        }
      } else {
        // Refresh all expanded directories
        const paths = Array.from(expandedFolders);
        for (const dirPath of paths) {
          try {
            await loadDirectory(dirPath);
          } catch {
            // Continue refreshing other directories
          }
        }
      }
    },
    [expandedFolders, loadDirectory]
  );

  /**
   * Open file in editor.
   * Deduplicates: focuses existing tab if already open.
   */
  const openFile = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const existingIndex = prev.indexOf(path);
      if (existingIndex !== -1) {
        // File already open - focus it
        setActiveTabIndex(existingIndex);
        return prev;
      }
      // Add new tab
      setActiveTabIndex(prev.length);
      return [...prev, path];
    });
  }, []);

  /**
   * Close tab at index.
   */
  const closeTab = useCallback((index: number) => {
    setOpenTabs((prev) => {
      const next = prev.filter((_, i) => i !== index);

      // Adjust active tab index
      setActiveTabIndex((prevActive) => {
        if (next.length === 0) return -1;
        if (prevActive >= next.length) return next.length - 1;
        if (prevActive > index) return prevActive - 1;
        return prevActive;
      });

      return next;
    });
  }, []);

  /**
   * Close all tabs except the specified index.
   */
  const closeOtherTabs = useCallback((index: number) => {
    setOpenTabs((prev) => {
      const target = prev[index];
      if (!target) return prev;
      setActiveTabIndex(0);
      return [target];
    });
  }, []);

  /**
   * Close tabs to the right of the specified index.
   */
  const closeTabsToRight = useCallback((index: number) => {
    setOpenTabs((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = prev.slice(0, index + 1);
      setActiveTabIndex((prevActive) => Math.min(prevActive, next.length - 1));
      return next;
    });
  }, []);

  /**
   * Set active tab by index.
   */
  const setActiveTab = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);

  /**
   * Create new file.
   */
  const createFile = useCallback(
    async (parentPath: string, filename: string, content = '') => {
      try {
        const filePath = `${parentPath}/${filename}`;
        // P1: Use window.api.* for IPC call
        await window.api.fs.createFile({ path: filePath, content });

        // Refresh parent directory
        await loadDirectory(parentPath);
      } catch (err) {
        const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to create file';
        setError(message);
        console.error('Failed to create file:', err);
        throw err;
      }
    },
    [loadDirectory]
  );

  /**
   * Create new folder.
   */
  const createFolder = useCallback(
    async (parentPath: string, folderName: string) => {
      try {
        const folderPath = `${parentPath}/${folderName}`;
        // P1: Use window.api.* for IPC call
        await window.api.fs.createDirectory({ path: folderPath });

        // Refresh parent directory
        await loadDirectory(parentPath);
      } catch (err) {
        const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to create folder';
        setError(message);
        console.error('Failed to create folder:', err);
        throw err;
      }
    },
    [loadDirectory]
  );

  /**
   * Rename file or folder.
   */
  const renameItem = useCallback(
    async (oldPath: string, newPath: string) => {
      try {
        // P1: Use window.api.* for IPC call
        await window.api.fs.rename({ oldPath, newPath });

        // Update open tabs if renamed item is open
        setOpenTabs((prev) => prev.map((tab) => (tab === oldPath ? newPath : tab)));

        // Refresh parent directory
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
        await loadDirectory(parentPath);
      } catch (err) {
        const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to rename item';
        setError(message);
        console.error('Failed to rename item:', err);
        throw err;
      }
    },
    [loadDirectory]
  );

  /**
   * Delete file or folder (moves to OS trash).
   */
  const deleteItem = useCallback(
    async (path: string) => {
      try {
        // P1: Use window.api.* for IPC call
        await window.api.fs.delete({ path, recursive: true });

        // Close tab if deleted item is open
        setOpenTabs((prev) => {
          const index = prev.indexOf(path);
          if (index !== -1) {
            closeTab(index);
          }
          return prev.filter((tab) => tab !== path);
        });

        // Refresh parent directory
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        await loadDirectory(parentPath);
      } catch (err) {
        const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Error).message : 'Failed to delete item';
        setError(message);
        console.error('Failed to delete item:', err);
        throw err;
      }
    },
    [loadDirectory, closeTab]
  );

  // Load workspace on mount
  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const value: FileTreeContextValue = {
    workspace,
    isLoading,
    error,
    expandedFolders,
    directoryCache,
    openTabs,
    activeTabIndex,
    loadWorkspace,
    openWorkspace,
    closeWorkspace,
    toggleFolder,
    collapseAll,
    loadDirectory,
    refresh,
    openFile,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    setActiveTab,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
  };

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}
