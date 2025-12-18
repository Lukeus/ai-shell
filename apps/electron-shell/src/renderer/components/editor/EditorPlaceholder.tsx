import React from 'react';

/**
 * EditorPlaceholder - Placeholder content for editor area.
 * 
 * Shows file path and message that Monaco is not yet implemented.
 * Monaco integration deferred to spec 040.
 * 
 * P5 (Performance): Monaco NOT loaded (placeholder only)
 * P4 (UI design): Tailwind 4 tokens for styling
 */

export interface EditorPlaceholderProps {
  /** Path of currently active file (null if no file open) */
  filePath: string | null;
}

export function EditorPlaceholder({ filePath }: EditorPlaceholderProps) {
  if (!filePath) {
    // Empty state: no file open
    return (
      <div className="flex items-center justify-center h-full bg-[var(--editor-bg)] text-[var(--secondary-fg)]">
        <div className="text-center">
          <svg
            width="64"
            height="64"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="mx-auto mb-4 opacity-50"
          >
            <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
          </svg>
          <p className="text-sm">Open a file to start editing</p>
        </div>
      </div>
    );
  }

  // Extract filename from path for display
  const filename = filePath.substring(filePath.lastIndexOf('/') + 1);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[var(--editor-bg)] text-[var(--editor-fg)] p-8">
      <div className="max-w-2xl text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="mx-auto mb-4 text-[var(--secondary-fg)]"
        >
          <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zm7 1v2h2l-2-2z" />
        </svg>

        <h2 className="text-lg font-semibold mb-2">{filename}</h2>
        <p className="text-sm text-[var(--secondary-fg)] mb-4">
          File: <code className="px-1 py-0.5 bg-[var(--input-bg)] rounded text-xs">{filePath}</code>
        </p>

        <div className="mt-8 p-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded">
          <p className="text-sm text-[var(--secondary-fg)]">
            Monaco editor not yet implemented.
          </p>
          <p className="text-xs text-[var(--secondary-fg)] mt-2">
            Code editor integration will be added in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
