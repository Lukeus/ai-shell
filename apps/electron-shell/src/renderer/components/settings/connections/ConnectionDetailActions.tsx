import React from 'react';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';

export function ConnectionDetailActions({ state, actions }: ConnectionDetailViewProps) {
  return (
    <>
      {state.mode === 'view' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={actions.onUpdate}
            disabled={state.isBusy || !state.canSubmit}
            className="px-3 py-2 text-xs font-semibold bg-accent text-[var(--vscode-button-foreground)] rounded-sm hover:bg-accent-hover disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      )}

      {state.mode === 'create' && !state.secretField && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={actions.onCreate}
            disabled={state.isBusy || !state.canSubmit}
            className="px-3 py-2 text-xs font-semibold bg-accent text-[var(--vscode-button-foreground)] rounded-sm hover:bg-accent-hover disabled:opacity-50"
          >
            Create connection
          </button>
        </div>
      )}
      {state.validationMessages.length > 0 && (
        <div className="text-[11px] text-status-error space-y-1">
          {state.validationMessages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
    </>
  );
}
