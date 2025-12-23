import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * ConfirmDeleteModal - Portal-rendered modal for delete confirmations.
 * 
 * Features:
 * - Renders in portal (outside component tree)
 * - Shows item name in confirmation message
 * - Escape key cancels
 * - Click outside cancels
 * - Confirm/Cancel buttons
 * 
 * P1 (Process isolation): Pure UI component, no Node.js access
 * P4 (UI design): Tailwind 4 tokens for styling
 */

export interface ConfirmDeleteModalProps {
  /** Name of the item to delete (file or folder) */
  itemName: string;
  /** Whether the item is a folder */
  isFolder?: boolean;
  /** Called when user confirms deletion */
  onConfirm: () => void;
  /** Called when user cancels deletion */
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  itemName,
  isFolder = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
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
        {/* Header */}
        <h2
          id="delete-modal-title"
          className="font-semibold text-primary"
          style={{ fontSize: 'var(--vscode-font-size-ui)' }}
        >
          Delete {isFolder ? 'Folder' : 'File'}
        </h2>

        {/* Message */}
        <p className="mt-2 text-secondary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          Are you sure you want to delete{' '}
          <strong className="text-primary">{itemName}</strong>?
          {isFolder && (
            <span className="block mt-2 text-xs text-secondary">
              The folder and all its contents will be moved to the trash.
            </span>
          )}
        </p>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
