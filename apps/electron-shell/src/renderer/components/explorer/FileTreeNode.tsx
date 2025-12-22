import React, { useEffect, useState } from 'react';
import type { FileEntry } from 'packages-api-contracts';
import { useFileTree } from './FileTreeContext';
import { InlineInput } from './InlineInput';

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

  const isDirectory = entry.type === 'directory';
  const isExpanded = isDirectory && expandedFolders.has(entry.path);
  const children = isExpanded ? directoryCache.get(entry.path) || [] : [];
  const isSelected = selectedEntry?.path === entry.path;
  const showInlineInput = Boolean(inlineInputMode) && isDirectory && inlineInputTargetPath === entry.path;

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
        className={`
          flex items-center cursor-pointer select-none
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
            />
          ))}
        </div>
      )}
    </>
  );
}
