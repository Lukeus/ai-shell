/**
 * Props for the StatusBar component.
 */
export interface StatusBarProps {
  /** Content for the left section (e.g., workspace name) */
  leftContent: React.ReactNode;
  
  /** Content for the right section (e.g., line/col, language, notifications) */
  rightContent: React.ReactNode;
}

/**
 * StatusBar component - Bottom fixed-height bar for status information.
 * 
 * Features:
 * - Fixed height (24px)
 * - Two-section layout: left (workspace name) and right (status items)
 * - Background: bg-blue-900
 * - Spans full width at bottom of layout
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <StatusBar
 *   leftContent={<span>No Folder Open</span>}
 *   rightContent={<span>UTF-8 | TypeScript</span>}
 * />
 * ```
 */
export function StatusBar({ leftContent, rightContent }: StatusBarProps) {
  return (
    <div className="h-7 flex items-center justify-between px-4 text-xs bg-surface-elevated border-t border-border-subtle">
      {/* Left section - workspace name or status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-surface-hover transition-colors duration-200">
          {leftContent}
        </div>
      </div>
      
      {/* Right section - status items */}
      <div className="flex items-center gap-0">
        {/* Add separators between items */}
        <div className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-surface-hover transition-colors duration-200">
          {rightContent}
        </div>
      </div>
    </div>
  );
}
