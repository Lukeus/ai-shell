import React, { useState } from 'react';

type SddParitySectionProps = {
  trackedRatio: number;
  trackedChanges: number;
  untrackedChanges: number;
  driftFilesCount: number;
  staleDocsCount: number;
  onReconcile?: (reason: string) => Promise<void>;
};

export function SddParitySection({
  trackedRatio,
  trackedChanges,
  untrackedChanges,
  driftFilesCount,
  staleDocsCount,
  onReconcile,
}: SddParitySectionProps) {
  const [reason, setReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canReconcile = Boolean(onReconcile) && untrackedChanges > 0;

  const handleReconcile = async () => {
    if (!onReconcile) {
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      setStatusMessage('Add a brief reason to record the drift override.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await onReconcile(trimmed);
      setReason('');
      setStatusMessage('Drift override recorded. Review drift files below.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Failed to record drift override.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          Parity
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {Math.round(trackedRatio * 100)}%
        </span>
      </div>
      <div
        className="flex flex-col gap-2"
        style={{
          paddingLeft: 'var(--vscode-space-3)',
          paddingRight: 'var(--vscode-space-3)',
          paddingBottom: 'var(--vscode-space-3)',
        }}
      >
        <div
          className="h-2 w-full rounded-full bg-surface-elevated overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full bg-accent"
            style={{ width: `${Math.round(trackedRatio * 100)}%` }}
          />
        </div>
        <div
          className="flex items-center justify-between text-tertiary"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          <span>Tracked: {trackedChanges}</span>
          <span>Untracked: {untrackedChanges}</span>
        </div>

        <div
          className="flex items-center justify-between text-tertiary"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          <span>Drift files: {driftFilesCount}</span>
          <span>Stale docs: {staleDocsCount}</span>
        </div>

        {canReconcile && (
          <div className="flex flex-col gap-2">
            <div className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              Reconcile drift by recording an override reason. This does not modify files.
            </div>
            <div className="flex items-center gap-2">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Override reason"
                className="flex-1 rounded-sm border border-border-subtle bg-surface text-primary"
                style={{
                  paddingLeft: 'var(--vscode-space-2)',
                  paddingRight: 'var(--vscode-space-2)',
                  paddingTop: 'var(--vscode-space-1)',
                  paddingBottom: 'var(--vscode-space-1)',
                  fontSize: 'var(--vscode-font-size-small)',
                }}
              />
              <button
                onClick={handleReconcile}
                disabled={isSubmitting}
                className="
                  rounded-sm border border-border-subtle text-secondary
                  hover:bg-surface-hover hover:text-primary
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                "
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingTop: 'var(--vscode-space-1)',
                  paddingBottom: 'var(--vscode-space-1)',
                  fontSize: 'var(--vscode-font-size-small)',
                }}
              >
                {isSubmitting ? 'Recording...' : 'Record override'}
              </button>
            </div>
            {statusMessage && (
              <div className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
                {statusMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
