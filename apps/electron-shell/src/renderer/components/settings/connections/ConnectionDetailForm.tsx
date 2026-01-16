import React from 'react';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';
import { ConnectionDetailActions } from './ConnectionDetailActions';
import { ConnectionDetailBasicsSection } from './ConnectionDetailBasicsSection';
import { ConnectionDetailConfigSection } from './ConnectionDetailConfigSection';
import { ConnectionDetailSecretSection } from './ConnectionDetailSecretSection';

export function ConnectionDetailForm({ state, actions }: ConnectionDetailViewProps) {
  return (
    <div
      className="p-6"
      style={{
        paddingLeft: 'var(--vscode-space-4)',
        paddingRight: 'var(--vscode-space-4)',
        paddingTop: 'var(--vscode-space-3)',
        paddingBottom: 'var(--vscode-space-4)',
      }}
    >
      <div className="space-y-6">
        <ConnectionDetailBasicsSection state={state} actions={actions} />
        <ConnectionDetailConfigSection state={state} actions={actions} />
        <ConnectionDetailSecretSection state={state} actions={actions} />
        <ConnectionDetailActions state={state} actions={actions} />
      </div>
    </div>
  );
}
