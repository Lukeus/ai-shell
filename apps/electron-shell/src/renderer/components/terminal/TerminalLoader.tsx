import React from 'react';

/**
 * TerminalLoader - Loading state component for terminal.
 *
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 * P5 (Performance budgets): Shown while xterm.js is being loaded dynamically.
 *
 * @remarks
 * - Follows EditorLoader pattern for consistency
 * - Minimal component with spinner and message
 */

export interface TerminalLoaderProps {
  /** Optional loading message */
  message?: string;
}

export function TerminalLoader({ message = 'Loading Terminal...' }: TerminalLoaderProps) {
  return (
      <div className="flex items-center justify-center h-full bg-surface text-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" />
          <p className="text-sm">{message}</p>
        </div>
      </div>
  );
}
