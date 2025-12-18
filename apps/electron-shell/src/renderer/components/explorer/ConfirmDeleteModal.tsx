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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <h2
          id="delete-modal-title"
          className="text-lg font-semibold mb-4 text-[var(--panel-fg)]"
        >
          Delete {isFolder ? 'Folder' : 'File'}
        </h2>

        {/* Message */}
        <p className="mb-6 text-[var(--secondary-fg)]">
          Are you sure you want to delete <strong className="text-[var(--panel-fg)]">{itemName}</strong>?
          {isFolder && (
            <span className="block mt-2 text-sm">
              The folder and all its contents will be moved to the trash.
            </span>
          )}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-[var(--error-bg)] text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
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
