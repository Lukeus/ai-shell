import React from 'react';
import type { ConnectionProvider } from 'packages-api-contracts';
import { Select } from 'packages-ui-kit';

export interface ProviderPickerProps {
  providers: ConnectionProvider[];
  value: string;
  onChange: (providerId: string) => void;
  disabled?: boolean;
}

export function ProviderPicker({
  providers,
  value,
  onChange,
  disabled = false,
}: ProviderPickerProps) {
  const options = providers.map((provider) => ({
    value: provider.id,
    label: provider.name,
  }));

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  );
}
