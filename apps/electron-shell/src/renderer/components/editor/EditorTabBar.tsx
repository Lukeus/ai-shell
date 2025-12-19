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
      className="flex items-center bg-surface-secondary border-b border-border-subtle overflow-x-auto scrollbar-thin"
      style={{
        height: '35px',
        scrollbarWidth: 'thin',
      }}
    >
      {openTabs.map((filePath, index) => {
        const isActive = index === activeTabIndex;
        const basename = getBasename(filePath);

        return (
          <div
            key={filePath}
            onClick={() => handleTabClick(index)}
            className={`
              relative flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none
              border-r border-border-subtle
              transition-all duration-150
              group
              ${
                isActive
                  ? 'bg-surface text-primary border-t-2 border-t-accent'
                  : 'bg-surface-secondary text-secondary hover:bg-surface-hover hover:text-primary'
              }
            `}
            style={{
              minWidth: '120px',
              maxWidth: '180px',
              marginTop: isActive ? '-2px' : '0',
            }}
            title={filePath}
          >
            {/* File icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 opacity-70"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>

            {/* File basename */}
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium">
              {basename}
            </span>

            {/* Close button */}
            <button
              onClick={(e) => handleCloseClick(e, index)}
              className="
                flex items-center justify-center rounded
                opacity-0 group-hover:opacity-100
                hover:bg-surface-elevated
                transition-all duration-150
                flex-shrink-0
              "
              style={{
                width: '20px',
                height: '20px',
              }}
              aria-label={`Close ${basename}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Active indicator line at top */}
            {isActive && (
              <div
                className="absolute top-0 left-0 right-0 h-0.5 bg-accent"
                style={{ marginTop: '-2px' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
