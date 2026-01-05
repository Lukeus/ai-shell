import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { SETTINGS_DEFAULTS, type Settings } from 'packages-api-contracts';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useFileTree, SETTINGS_TAB_ID } from '../explorer/FileTreeContext';
import { EditorTabBar } from './EditorTabBar';
import { EditorPlaceholder } from './EditorPlaceholder';
import { EditorLoader } from './EditorLoader';
import { BreadcrumbsBar, type BreadcrumbSegment } from './BreadcrumbsBar';
import type { BreadcrumbPosition, BreadcrumbSymbol, MonacoEditorHandle } from './MonacoEditor';
import { SettingsPanel } from '../settings/SettingsPanel';

/**
 * EditorArea - Main editor container component with Monaco Editor integration.
 *
 * P1 (Process isolation): File I/O via IPC only, renderer sandboxed.
 * P4 (Tailwind 4): All styles use CSS variables.
 * P5 (Performance budgets): Monaco lazy-loaded via EditorLoader, not loaded when no file open.
 * P6 (Contracts-first): Uses existing api-contracts for file reading (no new contracts needed).
 *
 * @remarks
 * - Combines EditorTabBar (top) and editor content area (bottom)
 * - Shows EditorPlaceholder when no file is open
 * - Loads Monaco Editor via EditorLoader when file is open
 * - Fetches file content from main process via IPC (FS_READ_FILE)
 * - Infers language from file extension for syntax highlighting
 */

type SettingsUpdateListener = (event: { detail?: Settings }) => void;

export function EditorArea() {
  const {
    openTabs,
    activeTabIndex,
    workspace,
    expandedFolders,
    toggleFolder,
    openFile,
    draftContents,
    setDraftContent,
    setSavedContent,
    setSelectedEntry,
  } = useFileTree();
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbsEnabled, setBreadcrumbsEnabled] = useState(
    SETTINGS_DEFAULTS.editor.breadcrumbsEnabled
  );
  const [lineNumbersEnabled, setLineNumbersEnabled] = useState(
    SETTINGS_DEFAULTS.editor.lineNumbers
  );
  const [minimapEnabled, setMinimapEnabled] = useState(
    SETTINGS_DEFAULTS.editor.minimap
  );
  const [wordWrapEnabled, setWordWrapEnabled] = useState(
    SETTINGS_DEFAULTS.editor.wordWrap
  );
  const [fontSize, setFontSize] = useState(
    SETTINGS_DEFAULTS.editor.fontSize
  );
  const [tabSize, setTabSize] = useState(
    SETTINGS_DEFAULTS.editor.tabSize
  );
  const [symbols, setSymbols] = useState<BreadcrumbSymbol[]>([]);
  const [cursorPosition, setCursorPosition] = useState<BreadcrumbPosition | null>(null);
  const [editorHandle, setEditorHandle] = useState<MonacoEditorHandle | null>(null);
  const { state: layoutState } = useLayoutContext();

  // Determine active file path
  const activeTabId =
    activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null;
  const isSettingsTab = activeTabId === SETTINGS_TAB_ID;
  const activeFilePath = isSettingsTab ? null : activeTabId;

  useEffect(() => {
    let isMounted = true;

    const loadBreadcrumbSetting = async () => {
      try {
        const settings = await window.api.getSettings();
        if (isMounted) {
          setBreadcrumbsEnabled(settings.editor.breadcrumbsEnabled);
          setLineNumbersEnabled(settings.editor.lineNumbers);
          setMinimapEnabled(settings.editor.minimap);
          setWordWrapEnabled(settings.editor.wordWrap);
          setFontSize(settings.editor.fontSize);
          setTabSize(settings.editor.tabSize);
        }
      } catch (error) {
        console.error('Failed to load breadcrumbs setting:', error);
      }
    };

    const settingsEventTarget = window as unknown as {
      addEventListener: (type: string, listener: SettingsUpdateListener) => void;
      removeEventListener: (type: string, listener: SettingsUpdateListener) => void;
    };

    const handleSettingsUpdated: SettingsUpdateListener = (event) => {
      const updated = event.detail;
      if (updated?.editor) {
        if (updated.editor.breadcrumbsEnabled !== undefined) {
          setBreadcrumbsEnabled(updated.editor.breadcrumbsEnabled);
        }
        if (updated.editor.lineNumbers !== undefined) {
          setLineNumbersEnabled(updated.editor.lineNumbers);
        }
        if (updated.editor.minimap !== undefined) {
          setMinimapEnabled(updated.editor.minimap);
        }
        if (updated.editor.wordWrap !== undefined) {
          setWordWrapEnabled(updated.editor.wordWrap);
        }
        if (updated.editor.fontSize !== undefined) {
          setFontSize(updated.editor.fontSize);
        }
        if (updated.editor.tabSize !== undefined) {
          setTabSize(updated.editor.tabSize);
        }
      }
    };

    void loadBreadcrumbSetting();
    settingsEventTarget.addEventListener('ai-shell:settings-updated', handleSettingsUpdated);

    return () => {
      isMounted = false;
      settingsEventTarget.removeEventListener('ai-shell:settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!activeFilePath) {
      const timer = setTimeout(() => {
        setSymbols([]);
        setCursorPosition(null);
        setEditorHandle(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setSymbols([]);
      setCursorPosition(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeFilePath]);

  useEffect(() => {
    if (!breadcrumbsEnabled) {
      const timer = setTimeout(() => {
        setSymbols([]);
        setCursorPosition(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [breadcrumbsEnabled]);

  // P1 (Process isolation): Fetch file content via IPC when active file changes
  useEffect(() => {
    if (!activeFilePath) {
      // Reset states when no file is open
      // Use setTimeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setFileContent('');
        setError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;
    const existingDraft = draftContents.get(activeFilePath);

    if (existingDraft !== undefined) {
      setFileContent(existingDraft);
      setIsLoading(false);
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    const fetchFileContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // P6 (Contracts-first): Use existing fs.readFile API from preload
        const response = await window.api.fs.readFile({ path: activeFilePath });

        if (!isMounted) return;

        const content = response.content || '';
        setFileContent(content);
        setSavedContent(activeFilePath, content);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to read file:', err);
        if (isMounted) {
          setError(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };

    fetchFileContent();

    return () => {
      isMounted = false;
    };
  }, [activeFilePath, draftContents, setSavedContent]);

  const handleSymbolsChange = useCallback((nextSymbols: BreadcrumbSymbol[]) => {
    setSymbols(nextSymbols);
  }, []);

  const handleCursorChange = useCallback((position: BreadcrumbPosition) => {
    setCursorPosition(position);
  }, []);

  const handleContentChange = useCallback(
    (nextContent: string) => {
      if (!activeFilePath) return;
      setFileContent(nextContent);
      setDraftContent(activeFilePath, nextContent);
    },
    [activeFilePath, setDraftContent]
  );

  const handleEditorReady = useCallback((handle: MonacoEditorHandle) => {
    setEditorHandle(handle);
  }, []);

  useEffect(() => {
    if (!editorHandle) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      editorHandle.layout();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    editorHandle,
    layoutState.primarySidebarWidth,
    layoutState.secondarySidebarWidth,
    layoutState.bottomPanelHeight,
    layoutState.primarySidebarCollapsed,
    layoutState.secondarySidebarCollapsed,
    layoutState.bottomPanelCollapsed,
  ]);

  const handleSymbolNavigate = useCallback(
    (symbol: BreadcrumbSymbol) => {
      if (!editorHandle) {
        return;
      }

      const targetRange = symbol.selectionRange ?? symbol.range;
      editorHandle.setPosition({
        lineNumber: targetRange.startLineNumber,
        column: targetRange.startColumn,
      });
      editorHandle.revealRangeInCenter(targetRange);
      editorHandle.focus();
    },
    [editorHandle]
  );

  const fileSegments = useMemo<BreadcrumbSegment[]>(() => {
    if (!activeFilePath) {
      return [];
    }

    const separator =
      activeFilePath.includes('\\') || workspace?.path.includes('\\') ? '\\' : '/';
    const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedFilePath = normalizePath(activeFilePath);
    const normalizedWorkspacePath = workspace ? normalizePath(workspace.path) : '';
    const fileParts = normalizedFilePath.split('/').filter(Boolean);
    const isInsideWorkspace =
      Boolean(normalizedWorkspacePath) &&
      normalizedFilePath.toLowerCase().startsWith(`${normalizedWorkspacePath.toLowerCase()}/`);
    const relativeParts = isInsideWorkspace
      ? normalizedFilePath.slice(normalizedWorkspacePath.length + 1).split('/').filter(Boolean)
      : fileParts;

    const buildWorkspacePath = (parts: string[]) => {
      if (!workspace) {
        return '';
      }
      const trimmedRoot = workspace.path.replace(/[\\/]+$/, '');
      return parts.length ? `${trimmedRoot}${separator}${parts.join(separator)}` : trimmedRoot;
    };

    const isAbsolutePath = normalizedFilePath.startsWith('/');
    const buildAbsolutePath = (parts: string[]) => {
      if (parts.length === 0) {
        return isAbsolutePath ? separator : '';
      }
      if (parts[0].endsWith(':')) {
        return parts.length > 1
          ? `${parts[0]}${separator}${parts.slice(1).join(separator)}`
          : parts[0];
      }
      const joined = parts.join(separator);
      return isAbsolutePath ? `${separator}${joined}` : joined;
    };

    const segments: BreadcrumbSegment[] = [];
    const canNavigateFolders = Boolean(workspace && isInsideWorkspace);
    const expandablePaths = canNavigateFolders
      ? relativeParts.map((_part, index) => buildWorkspacePath(relativeParts.slice(0, index + 1)))
      : [];

    if (workspace && isInsideWorkspace) {
      const workspaceLabel =
        workspace.name || normalizedWorkspacePath.split('/').filter(Boolean).pop() || workspace.path;
      segments.push({
        id: workspace.path,
        label: workspaceLabel,
        title: workspace.path,
        icon: <span className="codicon codicon-root-folder text-[12px]" aria-hidden="true" />,
        onClick: () => {
          setSelectedEntry({ path: workspace.path, type: 'directory' });
          window.dispatchEvent(new CustomEvent('ai-shell:focus-explorer'));
        },
      });
    }

    relativeParts.forEach((part, index) => {
      const isLast = index === relativeParts.length - 1;
      const fullPath = isInsideWorkspace
        ? buildWorkspacePath(relativeParts.slice(0, index + 1))
        : buildAbsolutePath(relativeParts.slice(0, index + 1));

      const folderPaths = canNavigateFolders ? expandablePaths.slice(0, index + 1) : [];

      segments.push({
        id: fullPath,
        label: part,
        title: fullPath,
        icon: (
          <span
            className={`codicon ${isLast ? 'codicon-file' : 'codicon-folder'} text-[12px]`}
            aria-hidden="true"
          />
        ),
        onClick: () => {
          if (isLast) {
            openFile(activeFilePath);
          } else {
            void (async () => {
              for (const path of folderPaths) {
                if (expandedFolders.has(path)) {
                  continue;
                }
                try {
                  await toggleFolder(path);
                } catch (expandError) {
                  console.error('Failed to expand folder:', expandError);
                }
              }
            })();
          }
          setSelectedEntry({ path: fullPath, type: isLast ? 'file' : 'directory' });
          window.dispatchEvent(new CustomEvent('ai-shell:focus-explorer'));
        },
      });
    });

    return segments;
  }, [activeFilePath, expandedFolders, openFile, toggleFolder, workspace, setSelectedEntry]);

  const symbolPath = useMemo(() => {
    if (!cursorPosition || symbols.length === 0) {
      return [];
    }

    const containsPosition = (range: BreadcrumbSymbol['range']) => {
      const startsBefore =
        cursorPosition.lineNumber > range.startLineNumber ||
        (cursorPosition.lineNumber === range.startLineNumber &&
          cursorPosition.column >= range.startColumn);
      const endsAfter =
        cursorPosition.lineNumber < range.endLineNumber ||
        (cursorPosition.lineNumber === range.endLineNumber &&
          cursorPosition.column <= range.endColumn);
      return startsBefore && endsAfter;
    };

    const findPath = (entries: BreadcrumbSymbol[]): BreadcrumbSymbol[] => {
      for (const symbol of entries) {
        if (!containsPosition(symbol.range)) {
          continue;
        }

        if (symbol.children && symbol.children.length > 0) {
          const childPath = findPath(symbol.children);
          return [symbol, ...childPath];
        }

        return [symbol];
      }

      return [];
    };

    return findPath(symbols);
  }, [cursorPosition, symbols]);

  const symbolSegments = useMemo<BreadcrumbSegment[]>(() => {
    if (symbolPath.length === 0) {
      return [];
    }

    return symbolPath.map((symbol, index) => ({
      id: `${symbol.name}:${symbol.range.startLineNumber}:${symbol.range.startColumn}:${index}`,
      label: symbol.name,
      title: symbol.name,
      onClick: editorHandle ? () => handleSymbolNavigate(symbol) : undefined,
    }));
  }, [editorHandle, handleSymbolNavigate, symbolPath]);

  const breadcrumbsVisible = breadcrumbsEnabled && Boolean(activeFilePath);

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      {/* Tab bar */}
      <EditorTabBar />
      {breadcrumbsVisible && (
        <BreadcrumbsBar fileSegments={fileSegments} symbolSegments={symbolSegments} />
      )}

      {/* Editor content area - NO extra padding/margin */}
      <div className="flex-1 overflow-hidden min-h-0 bg-surface">
        {isSettingsTab ? (
          <SettingsPanel />
        ) : !activeFilePath ? (
          // Empty state: no file open
          <EditorPlaceholder filePath={null} />
        ) : error ? (
          // Error state: failed to load file
          <div
            className="flex items-center justify-center h-full"
            style={{
              backgroundColor: 'var(--editor-bg)',
              color: 'var(--error-fg)',
            }}
          >
            <div
              className="text-center"
              style={{ padding: 'var(--vscode-space-4)' }}
            >
              <p>{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          // Loading state: fetching file content
          <div
            className="flex items-center justify-center h-full"
            style={{
              backgroundColor: 'var(--editor-bg)',
              color: 'var(--secondary-fg)',
            }}
          >
            <div className="text-center">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" 
                style={{ borderColor: 'var(--primary-fg)' }}
              />
              <p style={{ fontSize: 'var(--vscode-font-size-ui)' }}>Loading file...</p>
            </div>
          </div>
        ) : (
          // P5 (Performance budgets): Monaco loaded only when file is open
          // Suspense boundary for lazy-loading Monaco Editor
          <Suspense
            fallback={
              <div
                className="flex items-center justify-center h-full"
                style={{
                  backgroundColor: 'var(--editor-bg)',
                  color: 'var(--secondary-fg)',
                }}
              >
                <div className="text-center">
                  <div 
                    className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" 
                    style={{ borderColor: 'var(--primary-fg)' }}
                  />
                  <p style={{ fontSize: 'var(--vscode-font-size-ui)' }}>Loading Editor...</p>
                </div>
              </div>
            }
          >
            <EditorLoader
              filePath={activeFilePath}
              content={fileContent}
              fontSize={fontSize}
              tabSize={tabSize}
              lineNumbers={lineNumbersEnabled}
              minimap={minimapEnabled}
              wordWrap={wordWrapEnabled}
              onChange={handleContentChange}
              onEditorReady={handleEditorReady}
              onCursorChange={breadcrumbsEnabled ? handleCursorChange : undefined}
              onSymbolsChange={breadcrumbsEnabled ? handleSymbolsChange : undefined}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
