import React from 'react';
import type { ConnectionScope } from 'packages-api-contracts';
import { Input, Select } from 'packages-ui-kit';
import { ProviderPicker } from './ProviderPicker';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';

const fieldClassName =
  'w-full max-w-[360px] bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]';

export function ConnectionDetailBasicsSection({ state, actions }: ConnectionDetailViewProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[13px] font-medium text-primary mb-1">
          Provider
        </label>
        {state.mode === 'create' ? (
          <ProviderPicker
            providers={state.providers}
            value={state.providerId}
            onChange={actions.onProviderChange}
            className={fieldClassName}
          />
        ) : (
          <div className="text-sm text-secondary">
            {state.provider?.name ?? state.connection?.metadata.providerId}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-primary mb-1">
          Display name
        </label>
        <Input
          type="text"
          value={state.displayName}
          onChange={(next) => actions.onDisplayNameChange(String(next))}
          placeholder="My connection"
          className={fieldClassName}
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-primary mb-1">
          Scope
        </label>
        {state.mode === 'create' ? (
          <Select
            value={state.scope}
            onChange={(next) => actions.onScopeChange(next as ConnectionScope)}
            options={[
              { value: 'user', label: 'User' },
              { value: 'workspace', label: 'Workspace' },
            ]}
            className={fieldClassName}
          />
        ) : (
          <div className="text-sm text-secondary capitalize">
            {state.connection?.metadata.scope}
          </div>
        )}
      </div>
    </div>
  );
}
