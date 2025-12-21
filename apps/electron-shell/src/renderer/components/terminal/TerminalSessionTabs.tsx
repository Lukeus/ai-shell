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
    <div
      className={`flex items-center gap-2 border-b border-border bg-surface-elevated px-2 ${className}`}
      style={{ height: 'var(--vscode-list-rowHeight)' }}
    >
      {/* Session tabs */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
        {sessions.map((session, index) => {
          const isActive = session.sessionId === activeSessionId;
          const isRunning = session.status === 'running';
          
          return (
            <button
              key={session.sessionId}
              onClick={() => handleSelectSession(session.sessionId)}
              className={`
                flex items-center gap-2 px-2 h-full whitespace-nowrap
                border-b-2 transition-colors
                ${isActive 
                  ? 'bg-surface text-primary font-medium' 
                  : 'border-transparent hover:bg-surface-hover text-secondary'
                }
              `}
              style={{
                borderBottomColor: isActive ? 'var(--vscode-tab-activeBorderTop)' : 'transparent',
              }}
              disabled={isLoading}
            >
              <span className="codicon codicon-terminal text-sm" aria-hidden="true" />
              <span className="truncate max-w-[120px]">
                Terminal {index + 1}
              </span>
              {!isRunning && session.exitCode !== undefined && (
                <span className="text-[11px] text-error">
                  [{session.exitCode}]
                </span>
              )}
              <button
                onClick={(e) => handleCloseSession(session.sessionId, e)}
                className="ml-1 flex items-center justify-center w-5 h-5 rounded-sm text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
                title="Close terminal"
                disabled={isLoading}
              >
                <span className="codicon codicon-close" aria-hidden="true" />
              </button>
            </button>
          );
        })}
      </div>
      
      {/* New terminal button */}
      <button
        onClick={handleCreateSession}
        className="flex items-center justify-center w-6 h-6 rounded-sm text-secondary hover:text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
        disabled={isLoading}
        title="Create new terminal"
        aria-label="Create new terminal"
      >
        <span className="codicon codicon-add" aria-hidden="true" />
      </button>
      
      {/* Error message (if any) */}
      {error && (
        <div className="px-2 py-1 text-[11px] text-error bg-error-bg rounded">
          {error}
        </div>
      )}
    </div>
  );
}
