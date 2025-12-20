import React from 'react';
import { useTerminal } from '../../contexts/TerminalContext';
import { useFileTree } from '../explorer/FileTreeContext';

/**
 * TerminalSessionTabs - Tab management for multiple terminal sessions.
 *
 * P1 (Process isolation): Uses IPC via TerminalContext for session management.
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 *
 * @remarks
 * - Allows creating new terminal sessions
 * - Allows closing terminal sessions
 * - Allows switching between active sessions
 * - Shows session status (running/exited)
 */

export interface TerminalSessionTabsProps {
  /** Optional CSS class name */
  className?: string;
}

export function TerminalSessionTabs({ className = '' }: TerminalSessionTabsProps) {
  const {
    sessions,
    activeSessionId,
    createSession,
    closeSession,
    setActiveSession,
    isLoading,
    error,
  } = useTerminal();
  const { workspace } = useFileTree();

  const handleCreateSession = async () => {
    try {
      // P1: Let main process decide default shell; provide workspace cwd when available.
      const cwd = workspace?.path ?? '.';
      await createSession({ cwd, env: undefined });
    } catch (err) {
      console.error('Failed to create terminal session:', err);
    }
  };

  const handleCloseSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await closeSession(sessionId);
    } catch (err) {
      console.error('Failed to close terminal session:', err);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSession(sessionId);
  };

  return (
    <div className={`flex items-center gap-2 border-b border-border bg-surface-elevated ${className}`}>
      {/* Session tabs */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
      {sessions.map((session) => {
          const isActive = session.sessionId === activeSessionId;
          const isRunning = session.status === 'running';
          
          return (
            <button
              key={session.sessionId}
              onClick={() => handleSelectSession(session.sessionId)}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap
                border-b-2 transition-colors
                ${isActive 
                  ? 'border-primary bg-surface text-primary font-medium' 
                  : 'border-transparent hover:bg-surface-hover text-secondary'
                }
              `}
              disabled={isLoading}
            >
              {/* Status indicator */}
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-success' : 'bg-error'
                }`}
                title={isRunning ? 'Running' : 'Exited'}
              />
              
              {/* Session name */}
              <span className="truncate max-w-[120px]">
                Terminal {sessions.indexOf(session) + 1}
              </span>
              
              {/* Exit code (if exited) */}
              {!isRunning && session.exitCode !== undefined && (
                <span className="text-xs text-error">
                  [{session.exitCode}]
                </span>
              )}
              
              {/* Close button */}
              <button
                onClick={(e) => handleCloseSession(session.sessionId, e)}
                className="ml-1 hover:text-error transition-colors"
                title="Close terminal"
                disabled={isLoading}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </button>
          );
        })}
      </div>
      
      {/* New terminal button */}
      <button
        onClick={handleCreateSession}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
        disabled={isLoading}
        title="Create new terminal"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span>New</span>
      </button>
      
      {/* Error message (if any) */}
      {error && (
        <div className="px-3 py-2 text-sm text-error bg-error-bg rounded">
          {error}
        </div>
      )}
    </div>
  );
}
