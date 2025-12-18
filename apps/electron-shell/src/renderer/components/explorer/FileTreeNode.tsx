import React, { useState } from 'react';
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
 * - Hover actions: rename and delete icons
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
  /** Optional: Called when rename is requested (shows inline input) */
  onRenameStart?: (path: string) => void;
  /** Optional: Called when delete is requested */
  onDelete?: (path: string) => void;
}

export function FileTreeNode({ entry, depth, onRenameStart, onDelete }: FileTreeNodeProps) {
  const {
    expandedFolders,
    directoryCache,
    isLoading,
    toggleFolder,
    openFile,
  } = useFileTree();

  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const isDirectory = entry.type === 'directory';
  const isExpanded = isDirectory && expandedFolders.has(entry.path);
  const children = isExpanded ? directoryCache.get(entry.path) || [] : [];

  // Filter out dotfiles
  const filteredChildren = children.filter((child) => !child.name.startsWith('.'));

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      await toggleFolder(entry.path);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDirectory) {
      openFile(entry.path);
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    if (onRenameStart) {
      onRenameStart(entry.path);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(entry.path);
    }
  };

  const handleRenameCommit = async (_newName: string) => {
    setIsRenaming(false);
    // Rename logic will be handled by parent component
    // For now, just exit inline edit mode
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
  };

  // Calculate indentation based on depth
  const indentStyle = {
    paddingLeft: `${depth * 16 + 8}px`,
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
          flex items-center h-6 px-2 cursor-pointer
          hover:bg-[var(--list-hover-bg)]
          text-[var(--list-fg)]
          text-sm
        `}
        style={indentStyle}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-label={`${isDirectory ? 'Folder' : 'File'}: ${entry.name}`}
      >
        {/* Chevron (folders only) */}
        {isDirectory && (
          <button
            className="flex items-center justify-center w-4 h-4 mr-1 hover:bg-[var(--button-hover-bg)] rounded"
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            >
              <path d="M6 4l4 4-4 4z" />
            </svg>
          </button>
        )}

        {/* Spacer for files (no chevron) */}
        {!isDirectory && <div className="w-5" />}

        {/* Icon */}
        <div className="flex items-center justify-center w-4 h-4 mr-2">
          {isDirectory ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2h5l1 2h8v10H1V2z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
            </svg>
          )}
        </div>

        {/* Label */}
        <span className="flex-1 truncate">{entry.name}</span>

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

        {/* Hover actions */}
        {isHovered && !isLoading && (
          <div className="flex items-center gap-1 ml-2">
            {/* Rename button */}
            <button
              className="flex items-center justify-center w-4 h-4 hover:bg-[var(--button-hover-bg)] rounded"
              onClick={handleRename}
              aria-label="Rename"
              title="Rename"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.5 1l1.5 1.5L5 12.5 3.5 14H1v-2.5L10.5 2l1.5-1h1.5zM2 13h1l9-9-1-1-9 9v1z" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              className="flex items-center justify-center w-4 h-4 hover:bg-[var(--button-hover-bg)] rounded text-[var(--error-fg)]"
              onClick={handleDelete}
              aria-label="Delete"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 1h6v1H5V1zm-.5 2h7l-.5 11H5.5L5 3zm1 1l.4 9h1l-.4-9h-1zm3 0l-.4 9h1l.4-9h-1z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Recursive children rendering */}
      {isExpanded && filteredChildren.length > 0 && (
        <div role="group">
          {filteredChildren.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onRenameStart={onRenameStart}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}
