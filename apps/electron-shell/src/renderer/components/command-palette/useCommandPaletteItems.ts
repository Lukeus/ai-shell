import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommandContribution, FileEntry } from 'packages-api-contracts';
import { useExtensionCommands } from '../../hooks/useExtensionCommands';
import { useFileTree } from '../explorer/FileTreeContext';

export type BuiltInCommand = {
  id: string;
  title: string;
  category: string;
  enabled?: boolean;
  action: () => void | Promise<void>;
};

export type CommandItem = {
  id: string;
  label: string;
  commandId: string;
  searchText: string;
  kind: 'command';
  source: 'extension' | 'built-in';
  command: CommandContribution | BuiltInCommand;
  enabled: boolean;
};

export type FileItem = {
  id: string;
  label: string;
  path: string;
  searchText: string;
  kind: 'file';
};

export type PaletteItem = CommandItem | FileItem;

const buildExtensionLabel = (command: CommandContribution): string => {
  if (command.category) {
    return `Extension: ${command.category}: ${command.title}`;
  }
  return `Extension: ${command.title}`;
};

const buildBuiltInLabel = (command: BuiltInCommand): string =>
  `${command.category}: ${command.title}`;

export function useCommandPaletteItems(isOpen: boolean, builtInCommands: BuiltInCommand[] = []) {
  const { workspace } = useFileTree();
  const [query, setQuery] = useState('>');
  const isCommandMode = query.trim().startsWith('>');
  const searchQuery = !isCommandMode ? query.trim() : '';
  const { commands, isLoading: isExtensionsLoading, error: extensionsError } = useExtensionCommands(isOpen && isCommandMode);
  const [fileResults, setFileResults] = useState<string[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const fileIndexRef = useRef<string[] | null>(null);
  const lastWorkspacePathRef = useRef<string | null>(null);
  const latestSearchId = useRef(0);

  const excludedFolders = useMemo(() => new Set(['node_modules', '.git', 'dist', 'build', 'out']), []);

  const paletteCommands = useMemo<CommandItem[]>(() => {
    const builtIns = builtInCommands.map((command) => {
      const label = buildBuiltInLabel(command);
      return {
        id: command.id,
        label,
        commandId: command.id,
        searchText: `${label} ${command.id}`.toLowerCase(),
        kind: 'command' as const,
        source: 'built-in' as const,
        command,
        enabled: command.enabled ?? true,
      };
    });
    const extensions = commands.map((command) => {
      const label = buildExtensionLabel(command);
      return {
        id: command.id,
        label,
        commandId: command.id,
        searchText: `${label} ${command.id}`.toLowerCase(),
        kind: 'command' as const,
        source: 'extension' as const,
        command,
        enabled: true,
      };
    });
    return [...builtIns, ...extensions];
  }, [builtInCommands, commands]);

  const buildWorkspaceIndex = useCallback(async (root: string) => {
    const filePaths: string[] = [];
    const stack = [root];
    const maxFiles = 5000;

    while (stack.length > 0 && filePaths.length < maxFiles) {
      const current = stack.pop();
      if (!current) continue;

      let entries: FileEntry[] = [];
      try {
        const response = await window.api.fs.readDirectory({ path: current });
        entries = response.entries;
      } catch (err) {
        console.error('Failed to read directory for search:', err);
        continue;
      }

      for (const entry of entries) {
        if (entry.type === 'directory') {
          if (!excludedFolders.has(entry.name)) {
            stack.push(entry.path);
          }
        } else {
          filePaths.push(entry.path);
          if (filePaths.length >= maxFiles) break;
        }
      }
    }
    return filePaths;
  }, [excludedFolders]);

  useEffect(() => {
    if (!isOpen || isCommandMode) return;
    if (!workspace) {
      setFileResults([]);
      setIndexError('Open a folder to search workspace files.');
      return;
    }

    const workspacePath = workspace.path;
    if (lastWorkspacePathRef.current !== workspacePath) {
      fileIndexRef.current = null;
      lastWorkspacePathRef.current = workspacePath;
    }

    const searchId = ++latestSearchId.current;
    const runSearch = async () => {
      setIndexError(null);
      if (!fileIndexRef.current) {
        setIsIndexing(true);
        try {
          const files = await buildWorkspaceIndex(workspacePath);
          if (latestSearchId.current !== searchId) return;
          fileIndexRef.current = files;
        } catch (err) {
          console.error('Failed to build workspace index:', err);
          if (latestSearchId.current === searchId) setIndexError('Failed to index workspace files.');
        } finally {
          if (latestSearchId.current === searchId) setIsIndexing(false);
        }
      }

      if (latestSearchId.current !== searchId) return;
      const normalized = searchQuery.toLowerCase();
      if (!normalized) {
        setFileResults([]);
        return;
      }

      const files = fileIndexRef.current ?? [];
      const matches = files.filter((filePath) => filePath.toLowerCase().includes(normalized));
      setFileResults(matches.slice(0, 100));
    };

    void runSearch();
  }, [buildWorkspaceIndex, isCommandMode, isOpen, searchQuery, workspace]);

  const fileItems = useMemo<FileItem[]>(() => {
    if (!workspace) return [];
    return fileResults.map((filePath) => {
      const relative = filePath.startsWith(workspace.path)
        ? filePath.slice(workspace.path.length + 1)
        : filePath;
      return {
        id: filePath,
        label: relative,
        path: filePath,
        searchText: `${relative} ${filePath}`.toLowerCase(),
        kind: 'file' as const,
      };
    });
  }, [fileResults, workspace]);

  return {
    query,
    setQuery,
    isCommandMode,
    searchQuery,
    items: isCommandMode ? paletteCommands : fileItems,
    isLoading: isCommandMode ? isExtensionsLoading : isIndexing,
    error: isCommandMode ? extensionsError : indexError,
  };
}
