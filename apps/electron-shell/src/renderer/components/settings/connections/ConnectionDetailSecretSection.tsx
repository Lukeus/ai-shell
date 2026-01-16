import React from 'react';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';

const inputClassName = `
  w-full max-w-[360px]
  px-2 py-1.5 rounded-none
  bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]
  text-primary text-[13px]
  focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
  transition-colors duration-150
`;

export function ConnectionDetailSecretSection({ state, actions }: ConnectionDetailViewProps) {
  const secretField = state.secretField;
  if (!secretField) {
    return null;
  }

  return (
    <div>
      <h4 className="text-[13px] font-semibold text-primary mb-3">
        {state.mode === 'create' ? 'Secret' : 'Replace secret'}
      </h4>
      {state.mode === 'view' && state.connection?.metadata.secretRef && (
        <div className="text-[11px] text-secondary mb-2">
          A secret is stored for this connection.
        </div>
      )}
      <input
        type="password"
        value={state.mode === 'create' ? state.secretValue : state.replaceSecretValue}
        onChange={(event) =>
          state.mode === 'create'
            ? actions.onSecretChange(event.target.value)
            : actions.onReplaceSecretChange(event.target.value)
        }
        placeholder={secretField.placeholder ?? secretField.label}
        className={inputClassName}
      />
      <div className="mt-3">
        {state.mode === 'create' ? (
          <button
            type="button"
            onClick={actions.onCreate}
            disabled={state.isBusy || !state.canSubmit}
            className="px-3 py-2 text-xs font-semibold bg-accent text-[var(--vscode-button-foreground)] rounded-sm hover:bg-accent-hover disabled:opacity-50"
          >
            Create connection
          </button>
        ) : (
          <button
            type="button"
            onClick={actions.onReplaceSecret}
            disabled={state.isBusy || !state.replaceSecretValue.trim()}
            className="px-3 py-2 text-xs font-semibold bg-accent text-[var(--vscode-button-foreground)] rounded-sm hover:bg-accent-hover disabled:opacity-50"
          >
            Replace secret
          </button>
        )}
      </div>
    </div>
  );
}
