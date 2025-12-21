import React, { useEffect, useMemo, useState } from 'react';
import { TabBar, type Tab } from 'packages-ui-kit';
import { useFileTree } from '../explorer/FileTreeContext';

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
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    setActiveTab,
  } = useFileTree();
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const hasTabs = openTabs.length > 0;

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

  const tabs: Tab[] = useMemo(() => {
    return openTabs.map((path) => ({
      id: path,
      label: getBasename(path),
      icon: <span className="codicon codicon-file" aria-hidden="true" />,
      dirty: false,
    }));
  }, [openTabs]);

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
        onTabChange={handleChange}
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
