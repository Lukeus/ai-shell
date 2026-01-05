import React, { useRef } from 'react';
import { Modal } from 'packages-ui-kit';

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
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Modal
      open
      onClose={() => onCancel()}
      title={`Delete ${isFolder ? 'Folder' : 'File'}`}
      initialFocus={confirmRef}
      size="md"
    >
      <p className="text-secondary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
        Are you sure you want to delete{' '}
        <strong className="text-primary">{itemName}</strong>?
        {isFolder && (
          <span className="block mt-2 text-xs text-secondary">
            The folder and all its contents will be moved to the trash.
          </span>
        )}
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]"
          type="button"
        >
          Cancel
        </button>
        <button
          ref={confirmRef}
          onClick={onConfirm}
          className="px-3 py-1 rounded-sm text-sm border border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]"
          type="button"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
