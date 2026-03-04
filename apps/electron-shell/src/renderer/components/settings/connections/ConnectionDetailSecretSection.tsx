import React from 'react';
import { Input } from 'packages-ui-kit';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';
import { accentActionButtonClassName } from '../../shared/controlClassNames';

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
      <Input
        type="password"
        value={state.mode === 'create' ? state.secretValue : state.replaceSecretValue}
        onChange={(value) =>
          state.mode === 'create'
            ? actions.onSecretChange(String(value))
            : actions.onReplaceSecretChange(String(value))
        }
        placeholder={secretField.placeholder ?? secretField.label}
        className="w-full max-w-[360px] bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]"
      />
      <div className="mt-3">
        {state.mode === 'create' ? (
          <button
            type="button"
            onClick={actions.onCreate}
            disabled={state.isBusy || !state.canSubmit}
            className={accentActionButtonClassName}
          >
            Create connection
          </button>
        ) : (
          <button
            type="button"
            onClick={actions.onReplaceSecret}
            disabled={state.isBusy || !state.replaceSecretValue.trim()}
            className={accentActionButtonClassName}
          >
            Replace secret
          </button>
        )}
      </div>
    </div>
  );
}
