import React, { useCallback, useEffect, useState } from 'react';
import { useFileTree } from './FileTreeContext';
import { FileTreeNode } from './FileTreeNode';
import { InlineInput } from './InlineInput';
import { useSddStatus } from '../../hooks/useSddStatus';

/**
 * FileTree - Root tree component displaying workspace files and folders.
 * 
 * Features:
 * - Recursive FileTreeNode rendering
 * - Empty states (no workspace, no files, error)
 * - Lazy-loads directories on expand
 * - Inline input for new file/folder at tree root or selected folder
 * - Sorts: folders first, then files (both alphabetical)
 * - Filters: none (dotfiles and dotfolders shown)
 * - Loading spinner during IPC calls
 * 
 * P1 (Process isolation): Uses FileTreeContext (IPC via window.api), no Node.js access
 * P4 (UI design): Tailwind 4 tokens for theming
 */

export interface FileTreeProps {
  /** Optional: Mode for showing inline input (null = not shown) */
  inlineInputMode?: 'new-file' | 'new-folder' | null;
  /** Optional: Path for showing inline input under a folder */
  inlineInputTargetPath?: string | null;
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
  inlineInputTargetPath,
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
    setSelectedEntry,
  } = useFileTree();
  const { enabled: sddEnabled, status: sddStatus } = useSddStatus(workspace?.path);

  const [rootEntries, setRootEntries] = useState<typeof directoryCache extends Map<string, infer U> ? U : never>([]);
  const resolvedInlineInputTargetPath = inlineInputMode
    ? inlineInputTargetPath ?? workspace?.path ?? null
    : null;
  const handleSddBadgeClick = useCallback(
    (path: string) => {
      setSelectedEntry({ path, type: 'file' });
      window.dispatchEvent(new window.CustomEvent('ai-shell:open-sdd', { detail: { path } }));
    },
    [setSelectedEntry]
  );

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
        setRootEntries(entries);
      } else {
        setRootEntries([]);
      }
    };
    updateEntries();
  }, [workspace, directoryCache]);

  // Empty state: no workspace
  if (!workspace) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center text-secondary"
        style={{
          paddingLeft: 'var(--vscode-space-4)',
          paddingRight: 'var(--vscode-space-4)',
          fontSize: 'var(--vscode-font-size-ui)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mb-4 opacity-50"
        >
          <path d="M1 2h5l1 2h8v10H1V2z" />
        </svg>
        <p>No folder open</p>
        <p style={{ marginTop: 'var(--vscode-space-2)' }}>Open a folder to start exploring</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center"
        style={{
          paddingLeft: 'var(--vscode-space-4)',
          paddingRight: 'var(--vscode-space-4)',
          color: 'var(--error-fg)',
          fontSize: 'var(--vscode-font-size-ui)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mb-4"
        >
          <path d="M8 1L1 15h14L8 1zm0 3l4.5 10h-9L8 4zm0 3v3h1V7H8zm0 4v1h1v-1H8z" />
        </svg>
        <p style={{ fontSize: 'var(--vscode-font-size-small)', fontWeight: 600 }}>
          Error loading files
        </p>
        <p style={{ marginTop: 'var(--vscode-space-2)', fontSize: 'var(--vscode-font-size-small)' }}>
          {error}
        </p>
      </div>
    );
  }

  // Loading state (initial load)
  if (isLoading && rootEntries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-secondary"
        style={{ fontSize: 'var(--vscode-font-size-ui)' }}
      >
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
        <p style={{ fontSize: 'var(--vscode-font-size-small)' }}>Loading files...</p>
      </div>
    );
  }

  // Empty state: no files in workspace
  if (rootEntries.length === 0 && !inlineInputMode) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center text-secondary"
        style={{
          paddingLeft: 'var(--vscode-space-4)',
          paddingRight: 'var(--vscode-space-4)',
          fontSize: 'var(--vscode-font-size-ui)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mb-4 opacity-50"
        >
          <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
        </svg>
        <p style={{ fontSize: 'var(--vscode-font-size-small)' }}>No files in workspace</p>
        <p style={{ marginTop: 'var(--vscode-space-2)', fontSize: 'var(--vscode-font-size-small)' }}>
          Create a new file or folder to get started
        </p>
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto h-full w-full text-primary"
      role="tree"
      aria-label="File explorer tree"
      style={{ fontSize: 'var(--vscode-font-size-ui)' }}
    >
      {/* Inline input for new file/folder at root */}
      {inlineInputMode && resolvedInlineInputTargetPath === workspace?.path && (
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
          inlineInputMode={inlineInputMode}
          inlineInputTargetPath={resolvedInlineInputTargetPath}
          onInlineInputCommit={onInlineInputCommit}
          onInlineInputCancel={onInlineInputCancel}
          onRenameStart={onRenameStart}
          onDelete={onDelete}
          sddEnabled={sddEnabled}
          sddStatus={sddStatus}
          onSddBadgeClick={handleSddBadgeClick}
        />
      ))}
    </div>
  );
}
