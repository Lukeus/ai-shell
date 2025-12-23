import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ConsentDialogProps {
  isOpen: boolean;
  connectionName: string;
  requesterId: string;
  reason?: string;
  isBusy?: boolean;
  onAllowOnce: () => void;
  onAllowAlways: () => void;
  onDeny: () => void;
}

export function ConsentDialog({
  isOpen,
  connectionName,
  requesterId,
  reason,
  isBusy = false,
  onAllowOnce,
  onAllowAlways,
  onDeny,
}: ConsentDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDeny();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDeny]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onDeny();
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-dialog-title"
      aria-describedby="consent-dialog-description"
    >
      <div
        className="rounded-sm border shadow-lg"
        style={{
          backgroundColor: 'var(--vscode-editorWidget-background, var(--panel-bg))',
          borderColor: 'var(--vscode-editorWidget-border)',
          boxShadow: 'var(--vscode-widget-shadow)',
          width: 'min(520px, 92vw)',
          padding: 'var(--vscode-space-4)',
        }}
      >
        <h2
          id="consent-dialog-title"
          className="font-semibold text-primary"
          style={{ fontSize: 'var(--vscode-font-size-ui)' }}
        >
          Allow secret access?
        </h2>
        <p
          id="consent-dialog-description"
          className="text-secondary mt-2"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          <span className="text-primary font-medium">{requesterId}</span> is
          requesting access to the secret for{' '}
          <span className="text-primary font-medium">{connectionName}</span>.
        </p>
        {reason && (
          <div className="text-xs text-secondary bg-surface-secondary border border-border rounded-sm px-3 py-2 mt-3">
            Reason: {reason}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDeny}
            disabled={isBusy}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)] disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onAllowOnce}
            disabled={isBusy}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)] disabled:opacity-50"
          >
            Allow once
          </button>
          <button
            type="button"
            onClick={onAllowAlways}
            disabled={isBusy}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)] disabled:opacity-50"
          >
            Always allow
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
