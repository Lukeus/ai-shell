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
      <div className="flex flex-col h-full bg-surface">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wider">EXPLORER</h2>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center text-secondary animate-fade-in">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mb-6 opacity-40"
          >
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
          </svg>
          <p className="text-sm mb-6 text-tertiary">No folder open</p>
          <button
            onClick={openWorkspace}
            className="
              px-5 py-2.5 text-sm font-medium rounded-lg
              bg-accent text-primary
              hover:bg-accent-hover hover:scale-105
              active:scale-95
              transition-all duration-200
              shadow-lg
            "
            style={{ boxShadow: '0 4px 12px var(--color-glow-accent)' }}
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
      <div className="flex flex-col h-full bg-surface">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wider">{workspace.name}</h2>
        </div>

        {/* Error state */}
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center text-status-error animate-fade-in">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mb-6"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm font-semibold mb-2">Error loading files</p>
          <p className="text-xs mb-6 text-secondary">{error}</p>
          <button
            onClick={handleRetry}
            className="
              px-5 py-2.5 text-sm font-medium rounded-lg
              bg-accent text-primary
              hover:bg-accent-hover hover:scale-105
              active:scale-95
              transition-all duration-200
            "
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Normal state: workspace open
  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header with actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-secondary">
        <h2 className="flex-1 text-xs font-bold text-primary uppercase tracking-wider truncate">
          {workspace.name}
        </h2>

        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="
              w-6 h-6 flex items-center justify-center rounded
              hover:bg-surface-hover
              active:scale-95 disabled:opacity-50
              text-secondary hover:text-primary
            "
            title="Refresh"
            aria-label="Refresh"
          >
            <span className={`codicon codicon-refresh ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>

          <button
            onClick={handleNewFile}
            className="
              w-6 h-6 flex items-center justify-center rounded
              hover:bg-surface-hover
              active:scale-95
              text-secondary hover:text-primary
            "
            title="New File"
            aria-label="New File"
          >
            <span className="codicon codicon-new-file" aria-hidden="true" />
          </button>

          <button
            onClick={handleNewFolder}
            className="
              w-6 h-6 flex items-center justify-center rounded
              hover:bg-surface-hover
              active:scale-95
              text-secondary hover:text-primary
            "
            title="New Folder"
            aria-label="New Folder"
          >
            <span className="codicon codicon-new-folder" aria-hidden="true" />
          </button>

          <button
            onClick={handleCollapseAll}
            className="
              w-6 h-6 flex items-center justify-center rounded
              hover:bg-surface-hover
              active:scale-95
              text-secondary hover:text-primary
            "
            title="Collapse All"
            aria-label="Collapse All"
          >
            <span className="codicon codicon-collapse-all" aria-hidden="true" />
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
