import type { LayoutState } from 'packages-api-contracts';

/**
 * Props for the ShellLayout component.
 * This is a controlled component that manages a VS Code-like IDE layout with 6 distinct regions.
 */
export interface ShellLayoutProps {
  /** Activity bar content (leftmost vertical icon bar) */
  activityBar: React.ReactNode;
  
  /** Primary sidebar content (left panel, resizable and collapsible) */
  primarySidebar: React.ReactNode;
  
  /** Editor area content (center panel, takes remaining space) */
  editorArea: React.ReactNode;
  
  /** Secondary sidebar content (right panel, resizable and collapsible) */
  secondarySidebar: React.ReactNode;
  
  /** Bottom panel content (bottom horizontal panel, resizable and collapsible) */
  bottomPanel: React.ReactNode;
  
  /** Status bar content (bottom fixed-height bar) */
  statusBar: React.ReactNode;
  
  /** Current layout state (panel sizes and collapsed states) */
  layoutState: LayoutState;
  
  /** Callback when layout state changes */
  onLayoutChange: (newState: Partial<LayoutState>) => void;
}

/**
 * ShellLayout component - Root layout container for ai-shell IDE.
 * 
 * Implements a VS Code-like layout with 6 regions using CSS Grid:
 * - Activity Bar (fixed width, left)
 * - Primary Sidebar (resizable, collapsible, left)
 * - Editor Area (flexible, center)
 * - Secondary Sidebar (resizable, collapsible, right)
 * - Bottom Panel (resizable, collapsible, bottom)
 * - Status Bar (fixed height, bottom)
 * 
 * This is a controlled component - all state is managed by the parent via props.
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * 
 * @example
 * ```tsx
 * <ShellLayout
 *   activityBar={<ActivityBar />}
 *   primarySidebar={<ExplorerPanel />}
 *   editorArea={<EditorPlaceholder />}
 *   secondarySidebar={<AIAssistantPanel />}
 *   bottomPanel={<TerminalPanel />}
 *   statusBar={<StatusBar />}
 *   layoutState={state}
 *   onLayoutChange={handleChange}
 * />
 * ```
 */
export function ShellLayout({
  activityBar,
  primarySidebar,
  editorArea,
  secondarySidebar,
  bottomPanel,
  statusBar,
  layoutState,
  onLayoutChange: _onLayoutChange,
}: ShellLayoutProps) {
  // CSS Grid template areas define the layout structure
  // Layout: [Activity Bar] [Primary Sidebar] [Editor Area] [Secondary Sidebar]
  //         [Activity Bar] [Bottom Panel spans all except Activity Bar]
  //         [Status Bar spans entire width]
  
  const activityBarWidth = 'var(--size-activityBar-width, var(--vscode-activityBar-width))';
  const statusBarHeight = 'var(--size-statusBar-height, var(--vscode-statusBar-height))';
  const gridTemplateColumns = [
    activityBarWidth, // Activity Bar (fixed)
    layoutState.primarySidebarCollapsed ? '4px' : `${layoutState.primarySidebarWidth}px`,
    'minmax(0, 1fr)', // Editor Area (flexible, prevents overflow)
    layoutState.secondarySidebarCollapsed ? '4px' : `${layoutState.secondarySidebarWidth}px`,
  ].join(' ');

  const gridTemplateRows = [
    'minmax(0, 1fr)', // Top row (Activity Bar + sidebars + editor)
    layoutState.bottomPanelCollapsed ? '4px' : `${layoutState.bottomPanelHeight}px`,
    statusBarHeight, // Status Bar (fixed height)
  ].join(' ');

  return (
    <div
      className="h-full w-full min-h-0 min-w-0 overflow-hidden bg-surface"
      style={{
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows,
        gridTemplateAreas: `
          "activity-bar primary-sidebar editor-area secondary-sidebar"
          "activity-bar bottom-panel bottom-panel bottom-panel"
          "status-bar status-bar status-bar status-bar"
        `,
      }}
    >
      {/* Activity Bar - Leftmost vertical icon bar */}
      <div
        className="bg-surface-elevated border-r border-border-subtle overflow-hidden min-h-0 min-w-0"
        style={{ gridArea: 'activity-bar' }}
      >
        {activityBar}
      </div>

      {/* Primary Sidebar - Left collapsible/resizable panel */}
      <div
        className="bg-surface-secondary border-r border-border-subtle overflow-hidden min-h-0 min-w-0"
        style={{ gridArea: 'primary-sidebar', paddingBottom: statusBarHeight }}
      >
        {primarySidebar}
      </div>

      {/* Editor Area - Center main content area */}
      <div
        className="bg-surface overflow-auto min-h-0 min-w-0"
        style={{ gridArea: 'editor-area' }}
      >
        {editorArea}
      </div>

      {/* Secondary Sidebar - Right collapsible/resizable panel */}
      <div
        className="bg-surface-secondary border-l border-border-subtle overflow-visible min-h-0 min-w-0"
        style={{ gridArea: 'secondary-sidebar', paddingBottom: statusBarHeight }}
      >
        {secondarySidebar}
      </div>

      {/* Bottom Panel - Bottom horizontal collapsible/resizable panel */}
      <div
        className="bg-surface-secondary border-t border-border-subtle overflow-visible min-h-0 min-w-0"
        style={{ gridArea: 'bottom-panel' }}
      >
        {bottomPanel}
      </div>

      {/* Status Bar - Bottom fixed-height bar */}
      <div
        className="bg-transparent min-h-0 min-w-0"
        style={{ gridArea: 'status-bar' }}
      >
        {statusBar}
      </div>
    </div>
  );
}
