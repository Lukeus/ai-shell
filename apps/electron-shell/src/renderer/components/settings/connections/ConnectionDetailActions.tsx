import React from 'react';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';
import { accentActionButtonClassName } from '../../shared/controlClassNames';

export function ConnectionDetailActions({ state, actions }: ConnectionDetailViewProps) {
  return (
    <>
      {state.mode === 'view' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={actions.onUpdate}
            disabled={state.isBusy || !state.canSubmit}
            className={accentActionButtonClassName}
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
            className={accentActionButtonClassName}
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
