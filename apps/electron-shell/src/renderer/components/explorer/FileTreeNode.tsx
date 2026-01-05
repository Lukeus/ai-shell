import React, { useEffect, useState } from 'react';
import type { FileEntry, SddFileTraceResponse, SddStatus } from 'packages-api-contracts';
import { useFileTree } from './FileTreeContext';
import { InlineInput } from './InlineInput';
import { SddBadge } from '../sdd/SddBadge';

/**
 * FileTreeNode - Displays a single file or folder in the explorer tree.
 * 
 * Features:
 * - Chevron icon for folders (expand/collapse)
 * - File/folder icon
 * - Label with filename
 * - Selection highlight for active item
 * - Inline editing for rename
 * - Recursive rendering for expanded folders
 * 
 * P1 (Process isolation): Uses FileTreeContext (IPC via window.api), no Node.js access
 * P4 (UI design): Tailwind 4 tokens for theming
 */

export interface FileTreeNodeProps {
  /** File entry to display */
  entry: FileEntry;
  /** Nesting depth (for indentation) */
  depth: number;
  /** Optional: Mode for showing inline input (null = not shown) */
  inlineInputMode?: 'new-file' | 'new-folder' | null;
  /** Optional: Path for showing inline input under a folder */
  inlineInputTargetPath?: string | null;
  /** Optional: Called when inline input commits (new file/folder) */
  onInlineInputCommit?: (name: string) => void;
  /** Optional: Called when inline input cancels */
  onInlineInputCancel?: () => void;
  /** Optional: Called when rename is requested (shows inline input) */
  onRenameStart?: (path: string) => void;
  /** Optional: Called when delete is requested */
  onDelete?: (path: string) => void;
  /** Optional: Whether SDD is enabled */
  sddEnabled?: boolean;
  /** Optional: Latest SDD status snapshot */
  sddStatus?: SddStatus | null;
  /** Optional: Called when SDD badge is clicked */
  onSddBadgeClick?: (path: string) => void;
}

export function FileTreeNode({
  entry,
  depth,
  inlineInputMode,
  inlineInputTargetPath,
  onInlineInputCommit,
  onInlineInputCancel,
  onRenameStart,
  onDelete,
  sddEnabled,
  sddStatus,
  onSddBadgeClick,
}: FileTreeNodeProps) {
  const {
    expandedFolders,
    directoryCache,
    isLoading,
    toggleFolder,
    openFile,
    selectedEntry,
    setSelectedEntry,
  } = useFileTree();

  const [isRenaming, setIsRenaming] = useState(false);
  const [fileTrace, setFileTrace] = useState<SddFileTraceResponse | null>(null);

  const isDirectory = entry.type === 'directory';
  const isFile = entry.type === 'file';
  const isExpanded = isDirectory && expandedFolders.has(entry.path);
  const children = isExpanded ? directoryCache.get(entry.path) || [] : [];
  const isSelected = selectedEntry?.path === entry.path;

  useEffect(() => {
    if (isSelected) {
      const element = document.getElementById(`file-tree-node-${entry.path.replace(/[:\\/]/g, '-')}`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [isSelected, entry.path]);

  const showInlineInput = Boolean(inlineInputMode) && isDirectory && inlineInputTargetPath === entry.path;
  const isUntracked = Boolean(sddEnabled && sddStatus?.parity?.driftFiles?.includes(entry.path));
  const trackedRun = fileTrace?.runs?.[0];
  const showTrackedBadge = Boolean(!isUntracked && fileTrace?.runs?.length);

  useEffect(() => {
    if (!isFile || !sddEnabled || isUntracked || typeof window.api?.sdd?.getFileTrace !== 'function') {
      setFileTrace(null);
      return;
    }

    let isMounted = true;
    const loadTrace = async () => {
      try {
        const trace = await window.api.sdd.getFileTrace(entry.path);
        if (isMounted) {
          setFileTrace(trace);
        }
      } catch (traceError) {
        console.error('Failed to load SDD file trace:', traceError);
        if (isMounted) {
          setFileTrace(null);
        }
      }
    };

    void loadTrace();

    return () => {
      isMounted = false;
    };
  }, [
    entry.path,
    isFile,
    isUntracked,
    sddEnabled,
    sddStatus?.parity?.trackedFileChanges,
    sddStatus?.parity?.untrackedFileChanges,
  ]);

  const filteredChildren = children;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      setSelectedEntry({ path: entry.path, type: entry.type });
      await toggleFolder(entry.path);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedEntry({ path: entry.path, type: entry.type });
      if (isDirectory) {
        await toggleFolder(entry.path);
      } else {
        openFile(entry.path);
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      setIsRenaming(true);
      onRenameStart?.(entry.path);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      onDelete?.(entry.path);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEntry({ path: entry.path, type: entry.type });
    if (isDirectory) {
      void toggleFolder(entry.path);
      return;
    }
    openFile(entry.path);
  };

  const handleRenameCommit = async (_newName: string) => {
    setIsRenaming(false);
    // Rename logic will be handled by parent component
    // For now, just exit inline edit mode
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
  };

  useEffect(() => {
    if (showInlineInput && !isExpanded) {
      void toggleFolder(entry.path);
    }
  }, [entry.path, isExpanded, showInlineInput, toggleFolder]);

  // Calculate indentation based on depth
  const indentStyle = {
    paddingLeft: `${depth * 16 + 8}px`,
    height: 'var(--size-list-row)',
    lineHeight: 'var(--size-list-row)',
  };

  if (isRenaming) {
    return (
      <div style={indentStyle}>
        <InlineInput
          initialValue={entry.name}
          placeholder="Enter new name..."
          onCommit={handleRenameCommit}
          onCancel={handleRenameCancel}
        />
      </div>
    );
  }

  return (
    <>
      <div
        id={`file-tree-node-${entry.path.replace(/[:\\/]/g, '-')}`}
        className={`
          flex items-center w-full cursor-pointer select-none
          ${isSelected ? 'bg-[var(--vscode-list-activeSelectionBackground)]' : 'hover:bg-[var(--vscode-list-hoverBackground)]'}
          text-primary
        `}
        style={indentStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
        aria-label={`${isDirectory ? 'Folder' : 'File'}: ${entry.name}`}
        tabIndex={0}
      >
        {/* Chevron (folders only) */}
        {isDirectory && (
          <button
            className="flex items-center justify-center w-4 h-4 mr-1.5 hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            <span
              className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
              aria-hidden="true"
            />
          </button>
        )}

        {/* Spacer for files (no chevron) */}
        {!isDirectory && <div className="w-5" />}

        {/* Icon */}
        <div className="flex items-center justify-center w-5 h-5 mr-2 text-secondary">
          {isDirectory ? (
            <span className={`codicon ${isExpanded ? 'codicon-folder-opened' : 'codicon-folder'}`} aria-hidden="true" />
          ) : (
            <span className="codicon codicon-file" aria-hidden="true" />
          )}
        </div>

        {/* Label */}
        <span className="flex-1 truncate" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          {entry.name}
        </span>

        {(isUntracked || showTrackedBadge) && (
          <span className="ml-2 flex items-center">
            <SddBadge
              status={isUntracked ? 'untracked' : 'tracked'}
              title={
                isUntracked
                  ? 'Untracked change'
                  : trackedRun
                    ? `Tracked (${trackedRun.featureId} / ${trackedRun.taskId})`
                    : 'Tracked'
              }
              onClick={
                onSddBadgeClick
                  ? (event) => {
                      event.stopPropagation();
                      onSddBadgeClick(entry.path);
                    }
                  : undefined
              }
            />
          </span>
        )}

        {/* Loading spinner for expanding folder */}
        {isDirectory && isLoading && isExpanded && (
          <div className="w-4 h-4 ml-2">
            <svg
              className="animate-spin"
              width="16"
              height="16"
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
          </div>
        )}

      </div>

      {/* Recursive children rendering */}
      {isExpanded && (filteredChildren.length > 0 || showInlineInput) && (
        <div role="group">
          {showInlineInput && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              <InlineInput
                placeholder={inlineInputMode === 'new-file' ? 'New file name...' : 'New folder name...'}
                onCommit={onInlineInputCommit || (() => {})}
                onCancel={onInlineInputCancel || (() => {})}
              />
            </div>
          )}
          {filteredChildren.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              inlineInputMode={inlineInputMode}
              inlineInputTargetPath={inlineInputTargetPath}
              onInlineInputCommit={onInlineInputCommit}
              onInlineInputCancel={onInlineInputCancel}
              onRenameStart={onRenameStart}
              onDelete={onDelete}
              sddEnabled={sddEnabled}
              sddStatus={sddStatus}
              onSddBadgeClick={onSddBadgeClick}
            />
          ))}
        </div>
      )}
    </>
  );
}
