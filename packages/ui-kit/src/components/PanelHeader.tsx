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
    <div
      className="flex items-center justify-between px-3 border-b border-border-subtle bg-surface-secondary"
      style={{ height: 'var(--vscode-panelHeader-height)' }}
    >
      {/* Panel title with icon */}
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-semibold text-secondary uppercase tracking-wide">
          {title}
        </h2>
      </div>
      
      {/* Collapse/expand button */}
      <button
        onClick={onToggleCollapse}
        className="
          p-1 rounded-none transition-colors duration-150
          hover:bg-surface-hover
          group focus:outline-none focus:ring-1 focus:ring-accent
        "
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        aria-expanded={!collapsed}
      >
        <svg
          className="w-4 h-4 text-secondary transition-transform duration-200 group-hover:text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          {/* Chevron up - rotates 180deg when collapsed */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
