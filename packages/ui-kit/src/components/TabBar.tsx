import React from 'react';

/**
 * Tab item configuration.
 */
export interface Tab {
  /** Unique identifier for the tab */
  id: string;
  
  /** Display label for the tab */
  label: string;

  /** Optional title for hover tooltip */
  title?: string;
  
  /** Optional icon element to display before the label */
  icon?: React.ReactNode;
  
  /** Whether the tab is disabled */
  disabled?: boolean;

  /** Whether the tab has unsaved changes */
  dirty?: boolean;

  /** Whether the tab is pinned (prevents close button) */
  pinned?: boolean;

  /** Whether the tab can be closed (default: true) */
  closable?: boolean;

  /** Optional badge element to display after the label */
  badge?: React.ReactNode;
}

/**
 * Props for the TabBar component.
 */
export interface TabBarProps {
  /** Array of tab configurations */
  tabs: Tab[];
  
  /** ID of the currently active tab */
  activeTabId: string;
  
  /** Callback when a tab is clicked */
  onTabChange: (tabId: string) => void;

  /** Callback when a tab close is requested */
  onTabClose?: (tabId: string) => void;

  /** Callback when a context menu is requested */
  onTabContextMenu?: (tabId: string, event: React.MouseEvent) => void;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * TabBar component - Horizontal tab navigation with active state.
 * 
 * Features:
 * - ARIA roles for accessibility (role="tablist", role="tab")
 * - Keyboard navigation (Arrow keys, Home, End)
 * - Dirty / pinned indicators
 * - Context menu callback hook
 * - VS Code-aligned sizing/spacing
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <TabBar
 *   tabs={[
 *     { id: 'terminal', label: 'Terminal' },
 *     { id: 'output', label: 'Output', dirty: true },
 *     { id: 'problems', label: 'Problems', pinned: true }
 *   ]}
 *   activeTabId={activeTab}
 *   onTabChange={(id) => setActiveTab(id)}
 *   onTabClose={(id) => closeTab(id)}
 *   onTabContextMenu={(id, e) => showMenu(id, e)}
 * />
 * ```
 */
export function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabContextMenu,
  className = '',
}: TabBarProps) {
  const tabHeight = 'var(--tab-height, var(--vscode-tab-height))';
  const tabMinWidth = 'var(--tab-min-width, 120px)';
  const tabMaxWidth = 'var(--tab-max-width, 220px)';
  /**
   * Handle keyboard navigation between tabs.
   */
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const enabledTabs = tabs.filter(tab => !tab.disabled);
    const currentEnabledIndex = enabledTabs.findIndex(tab => tab.id === tabs[currentIndex].id);
    
    let nextIndex = currentEnabledIndex;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentEnabledIndex > 0 ? currentEnabledIndex - 1 : enabledTabs.length - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = currentEnabledIndex < enabledTabs.length - 1 ? currentEnabledIndex + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        return;
    }
    
    if (enabledTabs[nextIndex]) {
      onTabChange(enabledTabs[nextIndex].id);
    }
  };
  
  return (
    <div
      role="tablist"
      className={`flex items-center min-w-0 bg-[var(--vscode-tab-inactiveBackground)] overflow-x-auto overflow-y-hidden hide-scrollbar ${className}`}
      style={{ height: tabHeight }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isDisabled = tab.disabled || false;
        const isDirty = tab.dirty;
        const isPinned = tab.pinned;
        const showClose = tab.closable !== false && !isPinned;
        
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            title={tab.title ?? tab.label}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            aria-disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            onContextMenu={(e) => {
              if (isDisabled) return;
              onTabContextMenu?.(tab.id, e);
              e.preventDefault();
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              relative flex items-center gap-2 box-border
              text-[13px] font-normal transition-colors
              focus:outline-none focus:ring-1 focus:ring-accent focus:ring-inset
              ${isActive ? 'text-primary z-10' : 'text-secondary hover:text-primary'}
              ${isDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
              }
            `}
            style={{
              height: tabHeight,
              minWidth: tabMinWidth,
              maxWidth: tabMaxWidth,
              backgroundColor: isActive
                ? 'var(--vscode-tab-activeBackground)'
                : 'var(--vscode-tab-inactiveBackground)',
              borderRight: '1px solid var(--vscode-tab-border)',
              borderTop: isActive ? 'var(--vscode-border-width) solid var(--vscode-tab-activeBorderTop)' : 'var(--vscode-border-width) solid transparent',
              borderBottom: isActive ? '1px solid var(--vscode-tab-activeBackground)' : '1px solid var(--vscode-tab-border)',
              marginBottom: isActive ? '-1px' : '0',
              paddingLeft: 'var(--vscode-space-2)',
              paddingRight: 'var(--vscode-space-2)',
            }}
          >
            {tab.icon && (
              <span className="flex items-center">
                {tab.icon}
              </span>
            )}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 text-left">
              {tab.label}
            </span>
            {tab.badge && <span className="flex items-center">{tab.badge}</span>}
            {isPinned && (
              <span className="codicon codicon-pin text-secondary" aria-hidden="true" />
            )}
            {isDirty && !isPinned && (
              <span className="text-status-warning text-lg leading-none" aria-label="Unsaved changes">
                •
              </span>
            )}
            {showClose && (
              <span
                role="button"
                aria-label={`Close ${tab.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose?.(tab.id);
                }}
                className="
                  flex items-center justify-center w-5 h-5 rounded-sm
                  text-secondary hover:text-primary hover:bg-surface-elevated
                "
              >
                <span className="codicon codicon-close" aria-hidden="true" />
              </span>
            )}

            <span className="sr-only">{isActive ? 'Active' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
