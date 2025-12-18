import React, { useEffect, useState } from 'react';
import { useFileTree } from './FileTreeContext';
import { FileTreeNode } from './FileTreeNode';
import { InlineInput } from './InlineInput';

/**
 * FileTree - Root tree component displaying workspace files and folders.
 * 
 * Features:
 * - Recursive FileTreeNode rendering
 * - Empty states (no workspace, no files, error)
 * - Lazy-loads directories on expand
 * - Inline input for new file/folder at tree root
 * - Sorts: folders first, then files (both alphabetical)
 * - Filters: dotfiles not rendered
 * - Loading spinner during IPC calls
 * 
 * P1 (Process isolation): Uses FileTreeContext (IPC via window.api), no Node.js access
 * P4 (UI design): Tailwind 4 tokens for theming
 */

export interface FileTreeProps {
  /** Optional: Mode for showing inline input (null = not shown) */
  inlineInputMode?: 'new-file' | 'new-folder' | null;
  /** Optional: Called when inline input commits (new file/folder) */
  onInlineInputCommit?: (name: string) => void;
  /** Optional: Called when inline input cancels */
  onInlineInputCancel?: () => void;
  /** Optional: Called when rename is requested on a node */
  onRenameStart?: (path: string) => void;
  /** Optional: Called when delete is requested on a node */
  onDelete?: (path: string) => void;
}

export function FileTree({
  inlineInputMode,
  onInlineInputCommit,
  onInlineInputCancel,
  onRenameStart,
  onDelete,
}: FileTreeProps) {
  const {
    workspace,
    isLoading,
    error,
    directoryCache,
    loadDirectory,
  } = useFileTree();

  const [rootEntries, setRootEntries] = useState<typeof directoryCache extends Map<string, infer U> ? U : never>([]);

  // Load root directory when workspace changes
  useEffect(() => {
    if (workspace) {
      loadDirectory(workspace.path).catch((err) => {
        console.error('Failed to load root directory:', err);
      });
    }
  }, [workspace, loadDirectory]);

  // Update root entries when cache changes
  useEffect(() => {
    const updateEntries = () => {
      if (workspace) {
        const entries = directoryCache.get(workspace.path) || [];
        // Filter out dotfiles
        const filtered = entries.filter((entry) => !entry.name.startsWith('.'));
        setRootEntries(filtered);
      } else {
        setRootEntries([]);
      }
    };
    updateEntries();
  }, [workspace, directoryCache]);

  // Empty state: no workspace
  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center text-[var(--secondary-fg)]">
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mb-4 opacity-50"
        >
          <path d="M1 2h5l1 2h8v10H1V2z" />
        </svg>
        <p className="text-sm">No folder open</p>
        <p className="mt-2 text-xs">Open a folder to start exploring</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center text-[var(--error-fg)]">
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mb-4"
        >
          <path d="M8 1L1 15h14L8 1zm0 3l4.5 10h-9L8 4zm0 3v3h1V7H8zm0 4v1h1v-1H8z" />
        </svg>
        <p className="text-sm font-semibold">Error loading files</p>
        <p className="mt-2 text-xs">{error}</p>
      </div>
    );
  }

  // Loading state (initial load)
  if (isLoading && rootEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--secondary-fg)]">
        <svg
          className="animate-spin mb-4"
          width="32"
          height="32"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="10 26"
          />
        </svg>
        <p className="text-sm">Loading files...</p>
      </div>
    );
  }

  // Empty state: no files in workspace
  if (rootEntries.length === 0 && !inlineInputMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center text-[var(--secondary-fg)]">
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mb-4 opacity-50"
        >
          <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
        </svg>
        <p className="text-sm">No files in workspace</p>
        <p className="mt-2 text-xs">Create a new file or folder to get started</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto h-full text-[var(--list-fg)]"
      role="tree"
      aria-label="File explorer tree"
    >
      {/* Inline input for new file/folder at root */}
      {inlineInputMode && (
        <InlineInput
          placeholder={inlineInputMode === 'new-file' ? 'New file name...' : 'New folder name...'}
          onCommit={onInlineInputCommit || (() => {})}
          onCancel={onInlineInputCancel || (() => {})}
        />
      )}

      {/* Render root entries */}
      {rootEntries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          onRenameStart={onRenameStart}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
