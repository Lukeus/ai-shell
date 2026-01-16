import React from 'react';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';
import { ConnectionDetailForm } from './ConnectionDetailForm';
import { ConnectionDetailHeader } from './ConnectionDetailHeader';

export function ConnectionDetailView({ state, actions }: ConnectionDetailViewProps) {
  if (!state.providers.length) {
    return (
      <div className="flex-1 p-6 text-sm text-secondary">
        No connection providers are registered yet.
      </div>
    );
  }

  if (state.mode === 'view' && !state.connection) {
    return (
      <div className="flex-1 p-6 text-sm text-secondary">
        Select a connection to view details.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-surface">
      <ConnectionDetailHeader state={state} actions={actions} />
      <ConnectionDetailForm state={state} actions={actions} />
    </div>
  );
}
