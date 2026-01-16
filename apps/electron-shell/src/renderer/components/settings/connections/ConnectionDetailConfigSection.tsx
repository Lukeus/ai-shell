import React from 'react';
import type { ConnectionField } from 'packages-api-contracts';
import { Input, Select, ToggleSwitch } from 'packages-ui-kit';
import type { ConnectionDetailViewProps } from './ConnectionDetail.types';
import { getDefaultConfigValue } from './ConnectionDetail.utils';

const fieldClassName =
  'w-full max-w-[360px] bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]';

export function ConnectionDetailConfigSection({ state, actions }: ConnectionDetailViewProps) {
  const provider = state.provider;
  if (!provider) {
    return null;
  }

  const renderConfigField = (field: ConnectionField) => {
    const fieldValue = state.configValues[field.id] ?? getDefaultConfigValue(field);

    if (field.type === 'boolean') {
      return (
        <ToggleSwitch
          checked={Boolean(fieldValue)}
          onChange={(next) => actions.onConfigChange(field.id, next)}
          label={field.label}
        />
      );
    }

    if (field.type === 'select') {
      const options =
        field.options?.map((option) => ({
          value: option.value,
          label: option.label ?? option.value,
        })) ?? [];

      return (
        <Select
          value={String(fieldValue ?? '')}
          onChange={(next) => actions.onConfigChange(field.id, next)}
          options={options}
          className={fieldClassName}
        />
      );
    }

    if (field.type === 'number') {
      return (
        <Input
          type="number"
          value={fieldValue as string | number}
          onChange={(next) => actions.onConfigChange(field.id, next)}
          min={0}
          className={fieldClassName}
        />
      );
    }

    return (
      <Input
        type="text"
        value={fieldValue as string | number}
        onChange={(next) => actions.onConfigChange(field.id, next)}
        placeholder={field.placeholder}
        className={fieldClassName}
      />
    );
  };

  return (
    <div>
      <h4 className="text-[13px] font-semibold text-primary mb-3">
        Configuration
      </h4>
      <div className="space-y-4">
        {provider.fields
          .filter((field) => field.type !== 'secret')
          .map((field) => (
            <div key={field.id}>
              {field.type !== 'boolean' && (
                <label className="block text-[13px] font-medium text-primary mb-1">
                  {field.label}
                </label>
              )}
              {renderConfigField(field)}
              {field.helpText && (
                <div className="text-[11px] text-secondary mt-1">
                  {field.helpText}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
