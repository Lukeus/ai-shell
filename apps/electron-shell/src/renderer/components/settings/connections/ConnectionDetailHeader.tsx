import React from 'react';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';

export function ConnectionDetailHeader({ state, actions }: ConnectionDetailViewProps) {
  return (
    <div
      className="border-b border-border-subtle bg-surface-secondary"
      style={{
        paddingLeft: 'var(--vscode-space-3)',
        paddingRight: 'var(--vscode-space-3)',
        paddingTop: 'var(--vscode-space-2)',
        paddingBottom: 'var(--vscode-space-2)',
      }}
    >
      <div
        className="text-primary uppercase"
        style={{
          fontSize: 'var(--vscode-font-size-small)',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        {state.mode === 'create' ? 'New connection' : 'Connection details'}
      </div>
      <div className="text-[11px] text-secondary">
        Secrets are stored securely and never shown after saving.
      </div>
      {state.mode === 'view' && state.connection && (
        <button
          type="button"
          onClick={actions.onDelete}
          disabled={state.isBusy}
          className="mt-2 text-xs font-semibold text-status-error hover:text-status-error/80 disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}
