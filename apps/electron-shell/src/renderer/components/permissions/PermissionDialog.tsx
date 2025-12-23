import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PermissionGrant, PermissionScope } from 'packages-api-contracts';

const PERMISSION_DETAILS: Record<PermissionScope, { label: string; description: string }> = {
  'filesystem.read': {
    label: 'Read files',
    description: 'Allows the extension to read files within your workspace.',
  },
  'filesystem.write': {
    label: 'Write files',
    description: 'Allows the extension to create or modify files in your workspace.',
  },
  'network.http': {
    label: 'HTTP network access',
    description: 'Allows the extension to make outbound HTTP requests.',
  },
  'network.websocket': {
    label: 'WebSocket access',
    description: 'Allows the extension to open WebSocket connections.',
  },
  'secrets.read': {
    label: 'Read secrets',
    description: 'Allows the extension to request access to stored secrets.',
  },
  'secrets.write': {
    label: 'Write secrets',
    description: 'Allows the extension to store or update secrets.',
  },
  'ui.showMessage': {
    label: 'Show notifications',
    description: 'Allows the extension to show messages and notifications.',
  },
  'ui.showInput': {
    label: 'Request input',
    description: 'Allows the extension to prompt for user input.',
  },
  'terminal.create': {
    label: 'Create terminal sessions',
    description: 'Allows the extension to create terminal sessions.',
  },
  'terminal.write': {
    label: 'Write to terminal',
    description: 'Allows the extension to send input to terminal sessions.',
  },
};

interface PermissionDialogProps {
  extensionName: string;
  permissions: PermissionGrant[];
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
  onRevokeAll: () => void;
}

export function PermissionDialog({
  extensionName,
  permissions,
  isLoading,
  error,
  onClose,
  onRevokeAll,
}: PermissionDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-dialog-title"
    >
      <div
        className="rounded-sm border shadow-lg"
        style={{
          backgroundColor: 'var(--vscode-editorWidget-background, var(--panel-bg))',
          borderColor: 'var(--vscode-editorWidget-border)',
          boxShadow: 'var(--vscode-widget-shadow)',
          width: 'min(540px, 92vw)',
          padding: 'var(--vscode-space-4)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="permission-dialog-title"
              className="text-primary font-semibold"
              style={{ fontSize: 'var(--vscode-font-size-ui)' }}
            >
              Extension Permissions
            </h2>
            <p className="text-secondary text-sm mt-1">
              {extensionName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
            aria-label="Close permissions dialog"
          >
            <span className="codicon codicon-close" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-secondary text-sm">Loading permissions...</div>
          ) : error ? (
            <div className="text-status-error text-sm">{error}</div>
          ) : permissions.length === 0 ? (
            <div className="text-secondary text-sm">
              No permissions have been granted or denied yet.
            </div>
          ) : (
            <div className="space-y-3">
              {permissions.map((grant) => {
                const details = PERMISSION_DETAILS[grant.scope];
                return (
                  <div
                    key={`${grant.extensionId}:${grant.scope}`}
                    className="border border-border-subtle rounded-sm bg-surface px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-primary text-sm font-medium">
                        {details?.label ?? grant.scope}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 border ${
                          grant.granted
                            ? 'border-status-success text-status-success'
                            : 'border-status-error text-status-error'
                        }`}
                      >
                        {grant.granted ? 'Granted' : 'Denied'}
                      </span>
                    </div>
                    <p className="text-secondary text-xs mt-1">
                      {details?.description ?? 'No description available.'}
                    </p>
                    <p className="text-tertiary text-xs mt-1">
                      {grant.userDecision ? 'User decision' : 'Auto-granted from manifest'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4">
          <button
            onClick={onRevokeAll}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]"
            type="button"
          >
            Reset Permissions
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]"
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
