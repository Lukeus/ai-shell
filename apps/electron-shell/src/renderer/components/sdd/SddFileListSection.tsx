import React from 'react';

type SddFileListSectionProps = {
  title: string;
  files: string[];
  emptyText: string;
  onOpenFile: (path: string) => void;
  formatPath: (path: string) => string;
};

export function SddFileListSection({
  title,
  files,
  emptyText,
  onOpenFile,
  formatPath,
}: SddFileListSectionProps) {
  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          {title}
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {files.length}
        </span>
      </div>
      {files.length === 0 ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-col">
          {files.map((filePath) => (
            <button
              key={filePath}
              onClick={() => onOpenFile(filePath)}
              className="text-left hover:bg-surface-hover text-secondary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              {formatPath(filePath)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
