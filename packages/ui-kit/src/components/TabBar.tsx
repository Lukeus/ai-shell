import React from 'react';
import { Tab, TabGroup, TabList } from '@headlessui/react';

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
  onChange?: (tabId: string) => void;

  /** Callback when a tab is clicked (legacy) */
  onTabChange?: (tabId: string) => void;

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
 *   onChange={(id) => setActiveTab(id)}
 *   onTabClose={(id) => closeTab(id)}
 *   onTabContextMenu={(id, e) => showMenu(id, e)}
 * />
 * ```
 */
export function TabBar({
  tabs,
  activeTabId,
  onChange,
  onTabChange,
  onTabClose,
  onTabContextMenu,
  className = '',
}: TabBarProps) {
  const tabHeight = 'var(--vscode-tab-height)';
  const hasActiveTab = tabs.some(tab => tab.id === activeTabId);
  const resolvedActiveId = hasActiveTab ? activeTabId : (tabs[0]?.id ?? '');
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === resolvedActiveId));
  const handleChange = onChange ?? onTabChange;

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={(index) => {
        const tab = tabs[index];
        if (tab && !tab.disabled) {
          handleChange?.(tab.id);
        }
      }}
    >
      <TabList
        className={`flex items-center min-w-0 overflow-x-auto overflow-y-hidden hide-scrollbar ${className}`}
        style={{
          height: tabHeight,
          backgroundColor: 'var(--color-tab-border)',
          borderBottom: '1px solid var(--color-tab-border)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === resolvedActiveId;
          const isDisabled = tab.disabled || false;
          const isDirty = tab.dirty;
          const isPinned = tab.pinned;
          const showClose = tab.closable !== false && !isPinned;
          const showDirtyIndicator = Boolean(isDirty && !isPinned);
          const showCloseButton = showClose;
          const closeVisibilityClass = showCloseButton
            ? showDirtyIndicator
              ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              : isActive
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
            : 'hidden';
          const dirtyVisibilityClass = showDirtyIndicator
            ? 'group-hover:opacity-0 group-focus-within:opacity-0'
            : 'hidden';

          return (
          <Tab
            key={tab.id}
            type="button"
            title={tab.title ?? tab.label}
            disabled={isDisabled}
            onContextMenu={(e) => {
              if (isDisabled) return;
              onTabContextMenu?.(tab.id, e);
              e.preventDefault();
            }}
            className={({ selected }) => `
              group relative flex items-center gap-2 box-border min-w-0
              border-r px-3
              text-[var(--vscode-font-size-ui)] font-normal leading-[1]
              transition-colors
              focus:outline-none focus:ring-1 focus:ring-accent focus:ring-inset
              ${selected 
                ? 'text-primary z-10' 
                : 'text-secondary hover:text-primary'
              }
              ${isDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
              }
            `}
            style={{
              height: tabHeight,
              minWidth: 'var(--vscode-tab-minWidth)',
              maxWidth: 'var(--vscode-tab-maxWidth)',
              marginBottom: isActive ? '-1px' : '0',
              backgroundColor: isActive
                ? 'var(--color-tab-active)'
                : 'var(--color-tab-inactive)',
              borderRightColor: 'var(--color-tab-border)',
            }}
            data-active={isActive ? 'true' : 'false'}
          >
            {/* Top border for active tab - VS Code style */}
            {isActive && (
              <div 
                className="absolute top-0 left-0 right-0 h-[1px] bg-tab-active-border-top"
                aria-hidden="true"
              />
            )}

            {tab.icon && (
              <span className="flex items-center text-[14px]">
                {tab.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
              {tab.label}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {tab.badge && <span className="flex items-center shrink-0">{tab.badge}</span>}
              {isPinned && (
                <span className="codicon codicon-pin text-[12px] text-secondary" aria-hidden="true" />
              )}
              {showDirtyIndicator && (
                <span
                  className={`h-2 w-2 rounded-full transition-opacity ${dirtyVisibilityClass} ${
                    isActive ? 'bg-tab-active-border-top' : 'bg-text-tertiary'
                  }`}
                  aria-label="Unsaved changes"
                />
              )}
              {showCloseButton && (
                <span
                  role="button"
                  aria-label={`Close ${tab.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose?.(tab.id);
                  }}
                  className={`
                    flex items-center justify-center w-5 h-5 rounded-sm
                    text-secondary hover:text-primary hover:bg-surface-elevated transition-opacity
                    ${closeVisibilityClass}
                  `}
                >
                  <span className="codicon codicon-close text-[12px]" aria-hidden="true" />
                </span>
              )}
            </span>
            <span className="sr-only">{isActive ? 'Active' : ''}</span>
          </Tab>
          );
        })}
      </TabList>
    </TabGroup>
  );
}
