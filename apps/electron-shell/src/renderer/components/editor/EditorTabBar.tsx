import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TabBar, type Tab } from 'packages-ui-kit';
import type { SddFileTraceResponse } from 'packages-api-contracts';
import { useFileTree, SETTINGS_TAB_ID } from '../explorer/FileTreeContext';
import { useSddStatus } from '../../hooks/useSddStatus';
import { SddBadge } from '../sdd/SddBadge';

/**
 * EditorTabBar - Horizontal tab bar for open editor files.
 *
 * P1 (Process isolation): Uses FileTreeContext for tab state management.
 * P4 (Tailwind 4): All styles use CSS variables.
 * P5 (Monaco): Monaco integration deferred to spec 040.
 *
 * @remarks
 * - Displays horizontal tabs showing file basenames
 * - Active tab has accent bottom border
 * - Click tab: setActiveTab(), click X: closeTab()
 * - Empty state: renders nothing when no tabs open
 */

export function EditorTabBar() {
  const {
    openTabs,
    activeTabIndex,
    dirtyTabs,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    setActiveTab,
    setSelectedEntry,
    workspace,
  } = useFileTree();
  const { enabled: sddEnabled, status: sddStatus } = useSddStatus(workspace?.path);
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const [traceByPath, setTraceByPath] = useState<Record<string, SddFileTraceResponse | null>>({});

  const hasTabs = openTabs.length > 0;
  const fileTabs = useMemo(
    () => openTabs.filter((path) => path !== SETTINGS_TAB_ID),
    [openTabs]
  );

  /**
   * Extract basename from file path.
   */
  const getBasename = (path: string): string => {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return lastSlash === -1 ? path : path.substring(lastSlash + 1);
  };

  const activeTabId = hasTabs
    ? (activeTabIndex >= 0 ? openTabs[activeTabIndex] : openTabs[0])
    : '';

  const untrackedSet = useMemo(
    () => new Set(sddStatus?.parity?.driftFiles ?? []),
    [sddStatus?.parity?.driftFiles]
  );

  const handleBadgeClick = useCallback(
    (path: string) => {
      setSelectedEntry({ path, type: 'file' });
      window.dispatchEvent(new CustomEvent('ai-shell:open-sdd', { detail: { path } }));
    },
    [setSelectedEntry]
  );

  const tabs: Tab[] = useMemo(() => {
    return openTabs.map((path) => {
      if (path === SETTINGS_TAB_ID) {
        return {
          id: path,
          label: 'Settings',
          title: 'Settings',
          icon: <span className="codicon codicon-settings-gear text-[14px]" aria-hidden="true" />,
          dirty: false,
        };
      }

      let badge: React.ReactNode | undefined;
      if (sddEnabled && sddStatus?.parity) {
        const isUntracked = untrackedSet.has(path);
        if (isUntracked) {
          badge = (
            <SddBadge
              status="untracked"
              title="Untracked change"
              as="span"
              onClick={(event) => {
                event.stopPropagation();
                handleBadgeClick(path);
              }}
            />
          );
        } else {
          const trace = traceByPath[path];
          if (trace?.runs?.length) {
            const run = trace.runs[0];
            badge = (
              <SddBadge
                status="tracked"
                title={`Tracked (${run.featureId} / ${run.taskId})`}
                as="span"
                onClick={(event) => {
                  event.stopPropagation();
                  handleBadgeClick(path);
                }}
              />
            );
          }
        }
      }

      return {
        id: path,
        label: getBasename(path),
        title: path,
        icon: <span className="codicon codicon-file text-[14px]" aria-hidden="true" />,
        dirty: dirtyTabs.has(path),
        badge,
      };
    });
  }, [openTabs, dirtyTabs, handleBadgeClick, sddEnabled, sddStatus, traceByPath, untrackedSet]);

  useEffect(() => {
    if (!sddEnabled) {
      setTraceByPath({});
      return;
    }
    setTraceByPath((prev) => {
      const next: Record<string, SddFileTraceResponse | null> = {};
      fileTabs.forEach((path) => {
        if (prev[path]) {
          next[path] = prev[path];
        }
      });
      return next;
    });
  }, [fileTabs, sddEnabled]);

  useEffect(() => {
    if (!sddEnabled || typeof window.api?.sdd?.getFileTrace !== 'function') {
      return;
    }

    const pathsToFetch = fileTabs.filter(
      (path) => !untrackedSet.has(path) && !traceByPath[path]
    );
    if (pathsToFetch.length === 0) {
      return;
    }

    let isMounted = true;
    const loadTraces = async () => {
      await Promise.all(
        pathsToFetch.map(async (path) => {
          try {
            const trace = await window.api.sdd.getFileTrace(path);
            if (isMounted) {
              setTraceByPath((prev) => ({ ...prev, [path]: trace }));
            }
          } catch (traceError) {
            console.error('Failed to load SDD file trace:', traceError);
            if (isMounted) {
              setTraceByPath((prev) => ({ ...prev, [path]: null }));
            }
          }
        })
      );
    };

    void loadTraces();

    return () => {
      isMounted = false;
    };
  }, [
    fileTabs,
    sddEnabled,
    sddStatus?.parity?.trackedFileChanges,
    sddStatus?.parity?.untrackedFileChanges,
    traceByPath,
    untrackedSet,
  ]);

  const handleChange = (tabId: string) => {
    const index = openTabs.indexOf(tabId);
    if (index >= 0) {
      setActiveTab(index);
    }
  };

  const handleClose = (tabId: string) => {
    const index = openTabs.indexOf(tabId);
    if (index >= 0) {
      closeTab(index);
    }
  };

  const handleContextMenu = (tabId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const index = openTabs.indexOf(tabId);
    if (index >= 0) {
      setActiveTab(index);
    }
    setContextMenu({
      tabId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  // Close context menu on escape / click elsewhere
  useEffect(() => {
    if (!contextMenu) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    const handleClickAway = () => setContextMenu(null);

    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', handleClickAway);

    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClickAway);
    };
  }, [contextMenu]);

  // Empty state: no tabs open (return after hooks are registered)
  if (!hasTabs) {
    return null;
  }

  const runMenuAction = (action: 'close' | 'close-others' | 'close-right') => {
    if (!contextMenu) return;
    const index = openTabs.indexOf(contextMenu.tabId);
    if (index === -1) return;

    if (action === 'close') {
      closeTab(index);
    } else if (action === 'close-others') {
      closeOtherTabs(index);
    } else if (action === 'close-right') {
      closeTabsToRight(index);
    }
    setContextMenu(null);
  };

  return (
    <>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onChange={handleChange}
        onTabClose={handleClose}
        onTabContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <ul
          className="fixed z-50 bg-surface-elevated border border-border-subtle rounded-sm shadow-lg"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: '180px',
            fontSize: 'var(--vscode-font-size-ui)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <li>
            <button
              className="w-full text-left hover:bg-surface-hover"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
              }}
              onClick={() => runMenuAction('close')}
            >
              Close
            </button>
          </li>
          <li>
            <button
              className="w-full text-left hover:bg-surface-hover"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
              }}
              onClick={() => runMenuAction('close-others')}
            >
              Close Others
            </button>
          </li>
          <li>
            <button
              className="w-full text-left hover:bg-surface-hover"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
              }}
              onClick={() => runMenuAction('close-right')}
            >
              Close Tabs to the Right
            </button>
          </li>
        </ul>
      )}
    </>
  );
}
