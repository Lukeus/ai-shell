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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-dialog-title"
      aria-describedby="consent-dialog-description"
    >
      <div className="bg-surface border border-border rounded-lg shadow-lg p-6 max-w-lg w-full mx-4">
        <h2
          id="consent-dialog-title"
          className="text-lg font-semibold text-primary mb-2"
        >
          Allow secret access?
        </h2>
        <p
          id="consent-dialog-description"
          className="text-sm text-secondary mb-4"
        >
          <span className="text-primary font-medium">{requesterId}</span> is
          requesting access to the secret for{' '}
          <span className="text-primary font-medium">{connectionName}</span>.
        </p>
        {reason && (
          <div className="text-xs text-secondary bg-surface-secondary border border-border rounded-md px-3 py-2 mb-4">
            Reason: {reason}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDeny}
            disabled={isBusy}
            className="px-3 py-2 text-xs font-medium text-secondary border border-border rounded-md hover:text-primary hover:border-border/80 disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onAllowOnce}
            disabled={isBusy}
            className="px-3 py-2 text-xs font-medium bg-surface-secondary text-primary border border-border rounded-md hover:bg-surface-hover disabled:opacity-50"
          >
            Allow once
          </button>
          <button
            type="button"
            onClick={onAllowAlways}
            disabled={isBusy}
            className="px-3 py-2 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50"
          >
            Always allow
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
