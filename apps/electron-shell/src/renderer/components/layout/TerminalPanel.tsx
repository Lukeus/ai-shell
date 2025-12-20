import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { TabBar, type Tab } from 'packages-ui-kit';
import { useFileTree } from '../explorer/FileTreeContext';
import { useTerminal } from '../../contexts/TerminalContext';
import { TerminalView } from '../terminal/TerminalView';
import { TerminalSessionTabs } from '../terminal/TerminalSessionTabs';
import { OutputView } from '../output/OutputView';
import { ProblemsView } from '../problems/ProblemsView';

/**
 * Panel view types for bottom panel tabs.
 */
export type PanelView = 'terminal' | 'output' | 'problems';

/**
 * Generate stable hash for workspace path (for localStorage keys).
 * Same algorithm as FileTreeContext for consistency.
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
 * TerminalPanel component - Bottom panel with tabs for Terminal, Output, and Problems.
 * 
 * Features:
 * - Tab bar for switching between Terminal, Output, and Problems views
 * - Active tab persisted to localStorage scoped per workspace
 * - Placeholder views for each tab (actual implementations in future tasks)
 * 
 * Pure React component using browser APIs only (P1: Process isolation - no Node.js).
 * Styled with Tailwind 4 tokens (P4: UI design system).
 * 
 * @example
 * ```tsx
 * <TerminalPanel />
 * ```
 */
export function TerminalPanel() {
  const { workspace } = useFileTree();
  const { activeSessionId } = useTerminal();
  
  // Generate localStorage key scoped to workspace
  const storageKey = useMemo(() => {
    if (!workspace) return 'bottomPanel:activeTab:global';
    return `bottomPanel:activeTab:${hashWorkspacePath(workspace.path)}`;
  }, [workspace]);
  
  // Load active tab from localStorage
  const [activeTab, setActiveTab] = useState<PanelView>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['terminal', 'output', 'problems'].includes(stored)) {
        return stored as PanelView;
      }
    } catch (err) {
      console.warn('Failed to load active tab from localStorage:', err);
    }
    return 'terminal'; // Default to terminal
  });
  
  // Persist active tab to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, activeTab);
    } catch (err) {
      console.warn('Failed to persist active tab to localStorage:', err);
    }
  }, [storageKey, activeTab]);
  
  // Tab configurations
  const tabs: Tab[] = [
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <span className="codicon codicon-terminal" aria-hidden="true" />,
      closable: false,
    },
    {
      id: 'output',
      label: 'Output',
      icon: <span className="codicon codicon-output" aria-hidden="true" />,
      closable: false,
    },
    {
      id: 'problems',
      label: 'Problems',
      icon: <span className="codicon codicon-warning" aria-hidden="true" />,
      closable: false,
    },
  ];

  const tabBarStyle = {
    '--tab-height': '28px',
    '--tab-min-width': '88px',
    '--tab-max-width': '160px',
  } as CSSProperties;
  
  return (
    <div className="flex flex-col h-full min-h-0 bg-surface" style={tabBarStyle}>
      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as PanelView)}
        className="text-xs"
      />
      
      {/* Tab content */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-hidden min-h-0"
      >
        {activeTab === 'terminal' && (
          <div className="flex flex-col h-full min-h-0">
            <TerminalSessionTabs className="shrink-0 text-xs" />
            <div className="flex-1 overflow-hidden min-h-0">
              {activeSessionId ? (
                <TerminalView sessionId={activeSessionId} />
              ) : (
                <EmptyTerminalState />
              )}
            </div>
          </div>
        )}
        {activeTab === 'output' && <OutputView className="h-full" />}
        {activeTab === 'problems' && <ProblemsView className="h-full" />}
      </div>
    </div>
  );
}

/**
 * Empty state for Terminal tab when no sessions exist.
 */
function EmptyTerminalState() {
  return (
    <div className="flex items-center justify-center h-full text-secondary bg-surface">
      <div className="text-center">
        <span className="codicon codicon-terminal text-4xl mb-3 opacity-60" aria-hidden="true" />
        <p className="text-sm text-tertiary">Terminal</p>
        <p className="text-xs text-tertiary mt-2">No terminal sessions. Click + to create one.</p>
      </div>
    </div>
  );
}
