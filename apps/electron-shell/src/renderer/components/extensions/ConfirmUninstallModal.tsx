import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmUninstallModalProps {
  extensionName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmUninstallModal({
  extensionName,
  onConfirm,
  onCancel,
}: ConfirmUninstallModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="extension-uninstall-title"
    >
      <div
        className="rounded-sm border shadow-lg"
        style={{
          backgroundColor: 'var(--vscode-editorWidget-background, var(--panel-bg))',
          borderColor: 'var(--vscode-editorWidget-border)',
          boxShadow: 'var(--vscode-widget-shadow)',
          width: 'min(420px, 92vw)',
          padding: 'var(--vscode-space-4)',
        }}
      >
        <h2
          id="extension-uninstall-title"
          className="text-primary font-semibold"
          style={{ fontSize: 'var(--vscode-font-size-ui)' }}
        >
          Uninstall Extension
        </h2>
        <p
          className="text-secondary mt-2"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          Are you sure you want to uninstall <span className="text-primary">{extensionName}</span>?
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]"
            type="button"
            autoFocus
          >
            Uninstall
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
