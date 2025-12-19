/**
 * TerminalPanel component - Placeholder for the bottom terminal panel.
 * 
 * Displays a header and centered message when no terminal sessions are active.
 * This component will be replaced with xterm.js integration in future tasks.
 * 
 * Pure React component (P1: Process isolation - no Node.js, no IPC).
 * Styled with Tailwind 4 tokens (P4: UI design system).
 * 
 * @example
 * ```tsx
 * <TerminalPanel />
 * ```
 */
export function TerminalPanel() {
  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-accent-gradient-from to-accent-gradient-to rounded-full" />
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider">TERMINAL</h3>
        </div>
        {/* Action buttons could go here */}
      </div>
      
      {/* Terminal content */}
      <div className="flex items-center justify-center flex-1 text-secondary bg-surface">
        <div className="text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-4 opacity-40"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <p className="text-sm text-tertiary">No terminal sessions</p>
        </div>
      </div>
    </div>
  );
}
