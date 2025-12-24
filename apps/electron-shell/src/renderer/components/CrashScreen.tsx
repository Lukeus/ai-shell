import React from 'react';

type CrashScreenProps = {
  title?: string;
  message?: string;
  details?: string | null;
  logPath?: string | null;
  logError?: string | null;
  isLoadingLogs?: boolean;
  onReload: () => void;
  onRestartSafeMode: () => void;
  onOpenLogs: () => void;
  onCopyLogPath?: () => void;
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export function CrashScreen({
  title = 'Something went wrong',
  message = 'The renderer hit a fatal error and needs to recover.',
  details,
  logPath,
  logError,
  isLoadingLogs,
  onReload,
  onRestartSafeMode,
  onOpenLogs,
  onCopyLogPath,
}: CrashScreenProps) {
  const safeDetails = details ? truncate(details, 260) : null;

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-surface text-primary">
      <div
        className="flex w-full max-w-2xl flex-col gap-4 rounded-sm border border-border-subtle bg-surface-secondary animate-scale-up"
        style={{
          padding: 'var(--vscode-space-4)',
          margin: 'var(--vscode-space-4)',
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="codicon codicon-error text-status-error"
            style={{ fontSize: '24px' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              {title}
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {message}
            </span>
          </div>
        </div>

        {safeDetails && (
          <div
            className="rounded-sm border border-border-subtle bg-surface"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            <span className="text-tertiary">Error:</span>
            <div className="text-primary" style={{ marginTop: 'var(--vscode-space-1)' }}>
              {safeDetails}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onReload}
            className="
              rounded-sm bg-accent text-primary
              hover:bg-accent-hover active:opacity-90
              transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-2)',
              paddingBottom: 'var(--vscode-space-2)',
              fontSize: 'var(--vscode-font-size-ui)',
            }}
          >
            Reload window
          </button>
          <button
            onClick={onRestartSafeMode}
            className="
              rounded-sm border border-border-subtle text-secondary
              hover:bg-surface-hover hover:text-primary
              active:opacity-90 transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-2)',
              paddingBottom: 'var(--vscode-space-2)',
              fontSize: 'var(--vscode-font-size-ui)',
            }}
          >
            Restart in Safe Mode
          </button>
          <button
            onClick={onOpenLogs}
            disabled={Boolean(isLoadingLogs)}
            className="
              rounded-sm border border-border-subtle text-secondary
              hover:bg-surface-hover hover:text-primary
              disabled:opacity-60 disabled:cursor-not-allowed
              active:opacity-90 transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-2)',
              paddingBottom: 'var(--vscode-space-2)',
              fontSize: 'var(--vscode-font-size-ui)',
            }}
          >
            {isLoadingLogs ? 'Loading logs...' : 'Open logs'}
          </button>
        </div>

        {(logPath || logError) && (
          <div
            className="rounded-sm border border-border-subtle bg-surface"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {logError ? (
              <span className="text-status-error">{logError}</span>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="text-tertiary">Log path</div>
                <div className="flex flex-wrap items-center gap-2 text-primary">
                  <span className="break-all">{logPath}</span>
                  {onCopyLogPath && (
                    <button
                      onClick={onCopyLogPath}
                      className="
                        rounded-sm border border-border-subtle text-secondary
                        hover:bg-surface-hover hover:text-primary
                        active:opacity-90 transition-colors duration-150
                      "
                      style={{
                        paddingLeft: 'var(--vscode-space-2)',
                        paddingRight: 'var(--vscode-space-2)',
                        paddingTop: 'var(--vscode-space-1)',
                        paddingBottom: 'var(--vscode-space-1)',
                        fontSize: 'var(--vscode-font-size-small)',
                      }}
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
