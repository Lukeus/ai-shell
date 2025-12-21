import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommandContribution } from 'packages-api-contracts';
import type { FileEntry } from 'packages-api-contracts';
import { useExtensionCommands } from '../../hooks/useExtensionCommands';
import { useFileTree } from '../explorer/FileTreeContext';

type PaletteCommand = {
  id: string;
  label: string;
  source: 'extension' | 'built-in';
  command: CommandContribution | BuiltInCommand;
  enabled: boolean;
};

export type BuiltInCommand = {
  id: string;
  title: string;
  category: string;
  enabled?: boolean;
  action: () => void | Promise<void>;
};

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  builtInCommands?: BuiltInCommand[];
}

const buildExtensionLabel = (command: CommandContribution): string => {
  if (command.category) {
    return `Extension: ${command.category}: ${command.title}`;
  }
  return `Extension: ${command.title}`;
};

const buildBuiltInLabel = (command: BuiltInCommand): string =>
  `${command.category}: ${command.title}`;

export function CommandPalette({ isOpen, onClose, builtInCommands = [] }: CommandPaletteProps) {
  const { workspace, openFile } = useFileTree();
  const [query, setQuery] = useState('>');
  const isCommandMode = query.startsWith('>');
  const commandQuery = isCommandMode ? query.replace(/^>\s*/, '') : '';
  const searchQuery = !isCommandMode ? query.trim() : '';
  const { commands, isLoading, error } = useExtensionCommands(isOpen && isCommandMode);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fileResults, setFileResults] = useState<string[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileIndexRef = useRef<string[] | null>(null);
  const lastWorkspacePathRef = useRef<string | null>(null);
  const latestSearchId = useRef(0);

  const excludedFolders = useMemo(
    () => new Set(['node_modules', '.git', 'dist', 'build', 'out']),
    []
  );

  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const builtIns = builtInCommands.map((command) => ({
      id: command.id,
      label: buildBuiltInLabel(command),
      source: 'built-in' as const,
      command,
      enabled: command.enabled ?? true,
    }));
    const extensions = commands.map((command) => ({
      id: command.id,
      label: buildExtensionLabel(command),
      source: 'extension' as const,
      command,
      enabled: true,
    }));
    return [...builtIns, ...extensions];
  }, [builtInCommands, commands]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return paletteCommands;
    }
    return paletteCommands.filter((item) => {
      const title = item.label.toLowerCase();
      const id =
        item.source === 'extension'
          ? (item.command as CommandContribution).id.toLowerCase()
          : (item.command as BuiltInCommand).id.toLowerCase();
      return title.includes(normalizedQuery) || id.includes(normalizedQuery);
    });
  }, [commandQuery, paletteCommands]);

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
          if (filePaths.length >= maxFiles) {
            break;
          }
        }
      }
    }

    return filePaths;
  }, [excludedFolders]);

  useEffect(() => {
    if (!isOpen || isCommandMode) {
      return;
    }

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
          if (latestSearchId.current !== searchId) {
            return;
          }
          fileIndexRef.current = files;
        } catch (err) {
          console.error('Failed to build workspace index:', err);
          if (latestSearchId.current === searchId) {
            setIndexError('Failed to index workspace files.');
          }
        } finally {
          if (latestSearchId.current === searchId) {
            setIsIndexing(false);
          }
        }
      }

      if (latestSearchId.current !== searchId) {
        return;
      }

      const normalized = searchQuery.toLowerCase();
      if (!normalized) {
        setFileResults([]);
        return;
      }

      const files = fileIndexRef.current ?? [];
      const matches = files.filter((filePath) =>
        filePath.toLowerCase().includes(normalized)
      );
      setFileResults(matches.slice(0, 100));
    };

    void runSearch();
  }, [buildWorkspaceIndex, isCommandMode, isOpen, searchQuery, workspace]);

  const fileItems = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return fileResults.map((filePath) => {
      const relative = filePath.startsWith(workspace.path)
        ? filePath.slice(workspace.path.length + 1)
        : filePath;
      return {
        id: filePath,
        label: relative,
        path: filePath,
      };
    });
  }, [fileResults, workspace]);

  const executeCommand = useCallback(async (command: PaletteCommand | undefined) => {
    if (!command || !command.enabled) {
      return;
    }
    setActionError(null);
    try {
      if (command.source === 'built-in') {
        const builtIn = command.command as BuiltInCommand;
        await builtIn.action();
      } else {
        const extension = command.command as CommandContribution;
        await window.api.extensions.executeCommand(extension.id);
      }
      onClose();
    } catch (err) {
      console.error('Failed to execute command:', err);
      setActionError('Failed to execute command.');
    }
  }, [onClose]);

  const executeFileOpen = useCallback((filePath: string) => {
    openFile(filePath);
    onClose();
  }, [onClose, openFile]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('>');
    setSelectedIndex(0);
    setActionError(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const input = inputRef.current;
      if (input) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const listLength = isCommandMode ? filteredCommands.length : fileItems.length;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(listLength, 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => {
          const total = Math.max(listLength, 1);
          return (prev - 1 + total) % total;
        });
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (isCommandMode) {
          void executeCommand(filteredCommands[selectedIndex]);
        } else {
          const item = fileItems[selectedIndex];
          if (item) {
            executeFileOpen(item.path);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    executeCommand,
    executeFileOpen,
    fileItems,
    filteredCommands,
    isCommandMode,
    isOpen,
    onClose,
    selectedIndex,
  ]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const activeList = isCommandMode ? filteredCommands : fileItems;
  const activeLoading = isCommandMode ? isLoading : isIndexing;
  const activeError = isCommandMode ? error : indexError;
  const maxVisibleRows = 8;
  const rowHeightPx = 48;
  const listHeight = activeList.length > 0
    ? `${Math.min(activeList.length, maxVisibleRows) * rowHeightPx}px`
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="mt-16 w-full max-w-[720px] rounded-sm border border-border-subtle shadow-lg flex flex-col"
        style={{
          marginLeft: 'var(--vscode-space-4)',
          marginRight: 'var(--vscode-space-4)',
          backgroundColor: 'var(--vscode-menu-background)',
          color: 'var(--vscode-menu-foreground)',
          maxHeight: `min(70vh, ${maxVisibleRows * rowHeightPx + 80}px)`,
          height: 'fit-content',
        }}
      >
        <div
          className="border-b border-border-subtle"
          style={{ backgroundColor: 'var(--vscode-input-background)' }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder={isCommandMode ? 'Type a command...' : 'Type to search files...'}
            className="w-full bg-transparent text-primary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-ui)',
              outline: 'none',
              border: '1px solid var(--vscode-input-border)',
            }}
          />
        </div>

        {activeError && (
          <div className="px-4 py-2 text-xs text-status-error border-b border-border">
            {activeError}
          </div>
        )}

        {actionError && (
          <div className="px-4 py-2 text-xs text-status-error border-b border-border">
            {actionError}
          </div>
        )}

        <div
          className="overflow-auto"
          style={{
            maxHeight: `min(50vh, ${maxVisibleRows * rowHeightPx}px)`,
            height: listHeight,
          }}
        >
          {activeLoading ? (
            <div className="px-4 py-3 text-sm text-secondary">
              {isCommandMode ? 'Loading commands...' : 'Indexing workspace files...'}
            </div>
          ) : activeList.length === 0 ? (
            <div className="px-4 py-3 text-sm text-secondary">
              {isCommandMode
                ? 'No commands found.'
                : searchQuery
                  ? 'No files matched your search.'
                  : 'Start typing to search workspace files.'}
            </div>
          ) : (
            <div>
              {activeList.map((item, index) => {
                const isActive = index === selectedIndex;
                const isDisabled = isCommandMode ? !(item as PaletteCommand).enabled : false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isCommandMode) {
                        void executeCommand(item as PaletteCommand);
                      } else {
                        executeFileOpen((item as { path: string }).path);
                      }
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center justify-between text-left hover:bg-[var(--vscode-list-hoverBackground)] ${
                      isActive && !isDisabled
                        ? 'text-[var(--vscode-menu-selectionForeground)]'
                        : isDisabled
                          ? 'text-tertiary'
                          : 'text-primary'
                    }`}
                    style={{
                      padding: 'var(--vscode-space-2) var(--vscode-space-3)',
                      minHeight: `${rowHeightPx}px`,
                      backgroundColor: isActive
                        ? 'var(--vscode-list-activeSelectionBackground)'
                        : 'transparent',
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{item.label}</span>
                      {isCommandMode ? (
                        <span className="text-xs text-tertiary">
                          {(item as PaletteCommand).source === 'extension'
                            ? ((item as PaletteCommand).command as CommandContribution).id
                            : ((item as PaletteCommand).command as BuiltInCommand).id}
                        </span>
                      ) : (
                        <span className="text-xs text-tertiary">Workspace file</span>
                      )}
                    </div>
                    {isCommandMode ? (
                      <span className="text-xs text-tertiary">
                        {(item as PaletteCommand).source === 'extension' ? 'Extension' : 'Built-in'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
