import React from 'react';
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
  const { openTabs, activeTabIndex, closeTab, setActiveTab } = useFileTree();

  // Empty state: no tabs open
  if (openTabs.length === 0) {
    return null;
  }

  /**
   * Extract basename from file path.
   */
  const getBasename = (path: string): string => {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return lastSlash === -1 ? path : path.substring(lastSlash + 1);
  };

  /**
   * Handle tab click: set active tab.
   */
  const handleTabClick = (index: number) => {
    setActiveTab(index);
  };

  /**
   * Handle close button click: close tab.
   * Prevents event propagation to tab click handler.
   */
  const handleCloseClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    closeTab(index);
  };

  return (
    <div
      className="flex items-center border-b overflow-x-auto"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        height: '40px',
      }}
    >
      {openTabs.map((filePath, index) => {
        const isActive = index === activeTabIndex;
        const basename = getBasename(filePath);

        return (
          <div
            key={filePath}
            onClick={() => handleTabClick(index)}
            className="flex items-center gap-2 px-4 py-2 cursor-pointer select-none border-b-2 hover:bg-opacity-80"
            style={{
              backgroundColor: isActive ? 'var(--panel-bg)' : 'transparent',
              color: isActive ? 'var(--editor-fg)' : 'var(--secondary-fg)',
              borderBottomColor: isActive ? 'var(--accent-color, #007acc)' : 'transparent',
              minWidth: '100px',
              maxWidth: '200px',
            }}
            title={filePath}
          >
            {/* File basename */}
            <span
              className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ fontSize: '13px' }}
            >
              {basename}
            </span>

            {/* Close button */}
            <button
              onClick={(e) => handleCloseClick(e, index)}
              className="flex items-center justify-center hover:bg-opacity-20 rounded"
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: 'transparent',
                color: 'inherit',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`Close ${basename}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.707L8 8.707z" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
