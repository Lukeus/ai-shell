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
    <div className="h-6 flex items-center justify-between px-3 text-xs text-primary">
      {/* Left section - workspace name or status */}
      <div className="flex items-center gap-2">
        {leftContent}
      </div>
      
      {/* Right section - status items */}
      <div className="flex items-center gap-3">
        {rightContent}
      </div>
    </div>
  );
}
