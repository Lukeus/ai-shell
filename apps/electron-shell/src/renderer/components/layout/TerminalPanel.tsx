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
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-300 uppercase">Terminal</h3>
      </div>
      <div className="flex items-center justify-center flex-1 text-gray-400">
        <div className="text-center">
          <p className="text-sm">No terminal sessions</p>
        </div>
      </div>
    </div>
  );
}
