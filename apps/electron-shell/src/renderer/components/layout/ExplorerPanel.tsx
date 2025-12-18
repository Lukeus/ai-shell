import React, { useState } from 'react';
import { useFileTree } from '../explorer/FileTreeContext';
import { FileTree } from '../explorer/FileTree';
import { ConfirmDeleteModal } from '../explorer/ConfirmDeleteModal';

/**
 * ExplorerPanel - Root explorer component with file tree and header actions.
 * 
 * Features:
 * - Header with workspace name and action buttons
 * - Refresh, New File, New Folder, Collapse All buttons
 * - FileTree integration with inline input support
 * - Empty states: no folder open, no files, error
 * - Delete confirmation modal
 * 
 * P1 (Process isolation): All operations via FileTreeContext (IPC via window.api)
 * P4 (UI design): Tailwind 4 tokens for all colors
 */

type InlineInputMode = 'new-file' | 'new-folder' | null;

interface DeleteTarget {
  path: string;
  name: string;
  isFolder: boolean;
}

export function ExplorerPanel() {
  const {
    workspace,
    error,
    openWorkspace,
    collapseAll,
    refresh,
    createFile,
    createFolder,
    deleteItem,
  } = useFileTree();

  const [inlineInputMode, setInlineInputMode] = useState<InlineInputMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleNewFile = () => {
    setInlineInputMode('new-file');
  };

  const handleNewFolder = () => {
    setInlineInputMode('new-folder');
  };

  const handleCollapseAll = () => {
    collapseAll();
  };

  const handleInlineInputCommit = async (name: string) => {
    if (!workspace) return;

    try {
      if (inlineInputMode === 'new-file') {
        await createFile(workspace.path, name);
      } else if (inlineInputMode === 'new-folder') {
        await createFolder(workspace.path, name);
      }
    } catch (err) {
      console.error('Failed to create item:', err);
    } finally {
      setInlineInputMode(null);
    }
  };

  const handleInlineInputCancel = () => {
    setInlineInputMode(null);
  };

  const handleRenameStart = (_path: string) => {
    // Rename will be handled by FileTreeNode's inline input
    // This is just a placeholder for the callback
  };

  const handleDelete = (path: string) => {
    // Extract item name from path
    const name = path.substring(path.lastIndexOf('/') + 1);
    // Determine if folder based on workspace path structure
    const isFolder = path !== path.replace(/\/$/, '');
    
    setDeleteTarget({ path, name, isFolder });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      await deleteItem(deleteTarget.path);
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleRetry = () => {
    handleRefresh();
  };

  // Empty state: no workspace
  if (!workspace) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--panel-border)]">
          <h2 className="text-sm font-semibold text-[var(--panel-fg)]">EXPLORER</h2>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center text-[var(--secondary-fg)]">
          <svg
            width="48"
            height="48"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="mb-4 opacity-50"
          >
            <path d="M1 2h5l1 2h8v10H1V2z" />
          </svg>
          <p className="text-sm mb-4">No folder open</p>
          <button
            onClick={openWorkspace}
            className="px-4 py-2 text-sm rounded bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
          >
            Open Folder
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--panel-border)]">
          <h2 className="text-sm font-semibold text-[var(--panel-fg)]">{workspace.name}</h2>
        </div>

        {/* Error state */}
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center text-[var(--error-fg)]">
          <svg
            width="48"
            height="48"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="mb-4"
          >
            <path d="M8 1L1 15h14L8 1zm0 3l4.5 10h-9L8 4zm0 3v3h1V7H8zm0 4v1h1v-1H8z" />
          </svg>
          <p className="text-sm font-semibold mb-2">Error loading files</p>
          <p className="text-xs mb-4 text-[var(--secondary-fg)]">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 text-sm rounded bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Normal state: workspace open
  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex flex-col border-b border-[var(--panel-border)]">
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-sm font-semibold text-[var(--panel-fg)] truncate">
            {workspace.name}
          </h2>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 px-2 pb-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)] disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={isRefreshing ? 'animate-spin' : ''}
            >
              <path d="M13.5 2v4h-4M2.5 14v-4h4M13.5 6A6 6 0 104 2.5M2.5 10A6 6 0 1012 13.5" />
            </svg>
          </button>

          <button
            onClick={handleNewFile}
            className="p-1 rounded hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
            title="New File"
            aria-label="New File"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V5l-4-4zM9 2l3 3H9V2zm0 6h2v1H9v2H8V9H6V8h2V6h1v2z" />
            </svg>
          </button>

          <button
            onClick={handleNewFolder}
            className="p-1 rounded hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
            title="New Folder"
            aria-label="New Folder"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 4h-4l-1-1H3a1 1 0 00-1 1v8a1 1 0 001 1h11a1 1 0 001-1V5a1 1 0 00-1-1zm-3 5h-1v1H9v-1H8V8h1V7h1v1h1v1z" />
            </svg>
          </button>

          <button
            onClick={handleCollapseAll}
            className="p-1 rounded hover:bg-[var(--button-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-border)]"
            title="Collapse All"
            aria-label="Collapse All"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9 9H4v1h5v3l4-4-4-4v3zM2 4h12v1H2zM2 11h2v1H2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-hidden">
        <FileTree
          inlineInputMode={inlineInputMode}
          onInlineInputCommit={handleInlineInputCommit}
          onInlineInputCancel={handleInlineInputCancel}
          onRenameStart={handleRenameStart}
          onDelete={handleDelete}
        />
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          itemName={deleteTarget.name}
          isFolder={deleteTarget.isFolder}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  );
}
