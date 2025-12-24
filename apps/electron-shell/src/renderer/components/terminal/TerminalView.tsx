import React, { Suspense, lazy } from 'react';
import { TerminalLoader } from './TerminalLoader';
import { useTerminal } from '../../contexts/TerminalContext';

/**
 * TerminalView - Lazy-loading container for Terminal component.
 *
 * P1 (Process isolation): Runs in sandboxed renderer, communicates via IPC.
 * P5 (Performance budgets): Terminal component lazy-loaded, xterm.js excluded from initial bundle.
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 *
 * @remarks
 * - Follows EditorLoader pattern for lazy loading
 * - Uses React.lazy for dynamic import
 * - Shows TerminalLoader while loading
 * - Integrates with TerminalContext for session management
 */

// P5: Lazy-load Terminal component (which contains xterm.js dynamic import)
const LazyTerminal = lazy(() => import('./Terminal').then(module => ({ default: module.Terminal })));

export interface TerminalViewProps {
  /** Terminal session ID to display */
  sessionId: string;
}

export function TerminalView({ sessionId }: TerminalViewProps) {
  const { sessions, isLoading } = useTerminal();

  // Check if session exists
  const session = sessions.find(s => s.sessionId === sessionId);

  if (!session) {
    if (isLoading) {
      return (
        <div className="h-full w-full flex flex-col bg-surface">
          <TerminalLoader message="Loading Terminal..." />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full bg-surface text-error">
        <div className="text-center p-4">
          <p className="mb-4">Terminal session not found: {sessionId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-surface">
      <Suspense fallback={<TerminalLoader message="Loading Terminal..." />}>
        <LazyTerminal sessionId={sessionId} />
      </Suspense>
    </div>
  );
}
