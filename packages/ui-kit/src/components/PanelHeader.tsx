/**
 * Props for the PanelHeader component.
 */
export interface PanelHeaderProps {
  /** Panel title text */
  title: string;
  
  /** Whether the panel is currently collapsed */
  collapsed: boolean;
  
  /** Callback when collapse/expand button is clicked */
  onToggleCollapse: () => void;
}

/**
 * PanelHeader component - Header for panels with title and collapse/expand button.
 * 
 * Features:
 * - Displays panel title
 * - Collapse/expand button with chevron icon
 * - Button icon changes based on collapsed state
 * - Used by Primary Sidebar, Secondary Sidebar, and Bottom Panel
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <PanelHeader
 *   title="Explorer"
 *   collapsed={false}
 *   onToggleCollapse={() => setCollapsed(!collapsed)}
 * />
 * ```
 */
export function PanelHeader({ title, collapsed, onToggleCollapse }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      {/* Panel title */}
      <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
        {title}
      </h2>
      
      {/* Collapse/expand button */}
      <button
        onClick={onToggleCollapse}
        className="p-1 hover:bg-surface-secondary rounded transition-colors"
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        aria-expanded={!collapsed}
      >
        <svg
          className="w-4 h-4 text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {collapsed ? (
            // Chevron down for collapsed panels
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          ) : (
            // Chevron up for expanded panels
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          )}
        </svg>
      </button>
    </div>
  );
}
