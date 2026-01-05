import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type { Workspace, FileEntry } from 'packages-api-contracts';

export const SETTINGS_TAB_ID = '__settings__';

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
  dirtyTabs: Set<string>;
  draftContents: Map<string, string>;

  // Selection state
  selectedEntry: { path: string; type: FileEntry['type'] } | null;
  setSelectedEntry: (entry: { path: string; type: FileEntry['type'] } | null) => void;

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
  openSettingsTab: () => void;
  closeTab: (index: number) => void;
  closeOtherTabs: (index: number) => void;
  closeTabsToRight: (index: number) => void;
  setActiveTab: (index: number) => void;
  setDraftContent: (path: string, content: string) => void;
  setSavedContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
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
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [draftContents, setDraftContents] = useState<Map<string, string>>(new Map());
  const [savedContents, setSavedContents] = useState<Map<string, string>>(new Map());
  const draftContentsRef = useRef(draftContents);
  const savedContentsRef = useRef(savedContents);
  const dirtyTabsRef = useRef(dirtyTabs);
  const [selectedEntry, setSelectedEntry] = useState<{ path: string; type: FileEntry['type'] } | null>(null);

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
        const {
          expandedFolders: expanded,
          openTabs: tabs,
          settingsTabOpen,
        } = JSON.parse(stored);
        const shouldOpenSettingsTab = Boolean(settingsTabOpen);
        if (Array.isArray(expanded)) {
          setExpandedFolders(new Set(expanded));
        }
        if (Array.isArray(tabs)) {
          const sanitizedTabs = tabs.filter((tab) => tab !== SETTINGS_TAB_ID);
          const nextTabs = shouldOpenSettingsTab
            ? [...sanitizedTabs, SETTINGS_TAB_ID]
            : sanitizedTabs;
          setOpenTabs(nextTabs);
          if (nextTabs.length > 0) {
            setActiveTabIndex(0);
          }
        } else if (shouldOpenSettingsTab) {
          setOpenTabs([SETTINGS_TAB_ID]);
          setActiveTabIndex(0);
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
        openTabs: openTabs.filter((tab) => tab !== SETTINGS_TAB_ID),
        settingsTabOpen: openTabs.includes(SETTINGS_TAB_ID),
      };
      localStorage.setItem(localStorageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to persist file tree state:', err);
    }
  }, [localStorageKey, expandedFolders, openTabs]);

  useEffect(() => {
    draftContentsRef.current = draftContents;
  }, [draftContents]);

  useEffect(() => {
    savedContentsRef.current = savedContents;
  }, [savedContents]);

  useEffect(() => {
    dirtyTabsRef.current = dirtyTabs;
  }, [dirtyTabs]);

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
        setDirtyTabs(new Set());
        setDraftContents(new Map());
        setSavedContents(new Map());
        setSelectedEntry(null);
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
      setDirtyTabs(new Set());
      setDraftContents(new Map());
      setSavedContents(new Map());
      setError(null);
      setSelectedEntry(null);
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
        // Refresh root and all expanded directories
        const paths = [workspace?.path, ...Array.from(expandedFolders)].filter(
          (p): p is string => Boolean(p)
        );
        for (const dirPath of paths) {
          try {
            await loadDirectory(dirPath);
          } catch {
            // Continue refreshing other directories
          }
        }
      }
    },
    [workspace?.path, expandedFolders, loadDirectory]
  );

  /**
   * Load directory contents for all expanded folders on initialization.
   */
  useEffect(() => {
    if (!workspace || expandedFolders.size === 0) return;

    // Load directories that are expanded but not in cache
    const loadMissingDirectories = async () => {
      const foldersToLoad = Array.from(expandedFolders).filter((path) => !directoryCache.has(path));
      if (foldersToLoad.length === 0) return;

      // Use a flag to prevent multiple overlapping loads if needed, 
      // but loadDirectory is already safe and updates cache.
      for (const path of foldersToLoad) {
        try {
          await loadDirectory(path);
        } catch (err) {
          console.warn(`Failed to auto-load expanded directory ${path}:`, err);
        }
      }
    };

    loadMissingDirectories();
  }, [workspace, expandedFolders, directoryCache, loadDirectory]);

  /**
   * Open file in editor.
   * Deduplicates: focuses existing tab if already open.
   */
  const openFile = useCallback((path: string) => {
    setSelectedEntry({ path, type: 'file' });
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

  const openSettingsTab = useCallback(() => {
    setOpenTabs((prev) => {
      const existingIndex = prev.indexOf(SETTINGS_TAB_ID);
      if (existingIndex !== -1) {
        setActiveTabIndex(existingIndex);
        return prev;
      }
      setActiveTabIndex(prev.length);
      return [...prev, SETTINGS_TAB_ID];
    });
  }, []);

  /**
   * Close tab at index.
   */
  const closeTab = useCallback((index: number) => {
    const path = openTabs[index];
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
    if (path) {
      setDraftContents((prev) => {
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
      setSavedContents((prev) => {
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [openTabs]);

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
    setDraftContents((prev) => {
      const target = openTabs[index];
      if (!target) return prev;
      const next = new Map<string, string>();
      const value = prev.get(target);
      if (value !== undefined) {
        next.set(target, value);
      }
      return next;
    });
    setSavedContents((prev) => {
      const target = openTabs[index];
      if (!target) return prev;
      const next = new Map<string, string>();
      const value = prev.get(target);
      if (value !== undefined) {
        next.set(target, value);
      }
      return next;
    });
    setDirtyTabs((prev) => {
      const target = openTabs[index];
      if (!target) return prev;
      return prev.has(target) ? new Set([target]) : new Set();
    });
  }, [openTabs]);

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
    setDraftContents((prev) => {
      if (index < 0 || index >= openTabs.length) return prev;
      const keep = new Set(openTabs.slice(0, index + 1));
      const next = new Map<string, string>();
      keep.forEach((path) => {
        const value = prev.get(path);
        if (value !== undefined) {
          next.set(path, value);
        }
      });
      return next;
    });
    setSavedContents((prev) => {
      if (index < 0 || index >= openTabs.length) return prev;
      const keep = new Set(openTabs.slice(0, index + 1));
      const next = new Map<string, string>();
      keep.forEach((path) => {
        const value = prev.get(path);
        if (value !== undefined) {
          next.set(path, value);
        }
      });
      return next;
    });
    setDirtyTabs((prev) => {
      if (index < 0 || index >= openTabs.length) return prev;
      const keep = new Set(openTabs.slice(0, index + 1));
      return new Set(Array.from(prev).filter((path) => keep.has(path)));
    });
  }, [openTabs]);

  /**
   * Set active tab by index.
   */
  const setActiveTab = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);

  const setDraftContent = useCallback((path: string, content: string) => {
    setDraftContents((prev) => {
      const next = new Map(prev);
      next.set(path, content);
      return next;
    });
    const saved = savedContentsRef.current.get(path);
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      if (saved !== undefined && saved === content) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const setSavedContent = useCallback((path: string, content: string) => {
    setSavedContents((prev) => {
      const next = new Map(prev);
      next.set(path, content);
      return next;
    });
    setDraftContents((prev) => {
      const next = new Map(prev);
      next.set(path, content);
      return next;
    });
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const saveFile = useCallback(async (path: string) => {
    const draft = draftContentsRef.current.get(path);
    const saved = savedContentsRef.current.get(path);
    const content = draft ?? saved ?? '';
    await window.api.fs.writeFile({ path, content });
    setSavedContent(path, content);
  }, [setSavedContent]);

  const saveAllFiles = useCallback(async () => {
    const paths = Array.from(dirtyTabsRef.current);
    for (const path of paths) {
      await saveFile(path);
    }
  }, [saveFile]);

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
        setDraftContents((prev) => {
          if (!prev.has(oldPath)) return prev;
          const next = new Map(prev);
          const value = next.get(oldPath);
          next.delete(oldPath);
          if (value !== undefined) {
            next.set(newPath, value);
          }
          return next;
        });
        setSavedContents((prev) => {
          if (!prev.has(oldPath)) return prev;
          const next = new Map(prev);
          const value = next.get(oldPath);
          next.delete(oldPath);
          if (value !== undefined) {
            next.set(newPath, value);
          }
          return next;
        });
        setDirtyTabs((prev) => {
          if (!prev.has(oldPath)) return prev;
          const next = new Set(prev);
          next.delete(oldPath);
          next.add(newPath);
          return next;
        });

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
        setDraftContents((prev) => {
          const next = new Map(prev);
          next.delete(path);
          return next;
        });
        setSavedContents((prev) => {
          const next = new Map(prev);
          next.delete(path);
          return next;
        });
        setDirtyTabs((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
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
    dirtyTabs,
    draftContents,
    selectedEntry,
    setSelectedEntry,
    loadWorkspace,
    openWorkspace,
    closeWorkspace,
    toggleFolder,
    collapseAll,
    loadDirectory,
    refresh,
    openFile,
    openSettingsTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    setActiveTab,
    setDraftContent,
    setSavedContent,
    saveFile,
    saveAllFiles,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
  };

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}
