import React, { useCallback, useMemo, useState } from 'react';
import type {
  Connection,
  ConnectionConfig,
  ConnectionField,
  ConnectionProvider,
  ConnectionScope,
} from 'packages-api-contracts';
import { Input, Select, ToggleSwitch } from 'packages-ui-kit';
import { ProviderPicker } from './ProviderPicker';

export interface ConnectionFormValues {
  providerId: string;
  scope: ConnectionScope;
  displayName: string;
  config: ConnectionConfig;
  secretValue?: string;
}

export interface ConnectionDetailProps {
  mode: 'create' | 'view';
  connection: Connection | null;
  providers: ConnectionProvider[];
  isBusy: boolean;
  onCreate: (values: ConnectionFormValues) => Promise<void>;
  onUpdate: (connectionId: string, values: ConnectionFormValues) => Promise<void>;
  onDelete: (connectionId: string) => Promise<void>;
  onReplaceSecret: (connectionId: string, secretValue: string) => Promise<void>;
}

const inputClassName = `
  w-full max-w-[360px]
  px-2 py-1.5 rounded-none
  bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]
  text-primary text-[13px]
  focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
  transition-colors duration-150
`;

const fieldClassName =
  'w-full max-w-[360px] bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]';

const getDefaultConfigValue = (field: ConnectionField) => {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  if (field.type === 'boolean') {
    return false;
  }

  return '';
};

const buildInitialConfig = (
  provider: ConnectionProvider | undefined,
  existingConfig?: ConnectionConfig
) => {
  const nextConfig: ConnectionConfig = {};

  if (!provider) return nextConfig;

  provider.fields
    .filter((field) => field.type !== 'secret')
    .forEach((field) => {
      const existingValue = existingConfig?.[field.id];
      if (existingValue !== undefined) {
        nextConfig[field.id] = existingValue;
        return;
      }

      nextConfig[field.id] = getDefaultConfigValue(field);
    });

  return nextConfig;
};

const buildConfigPayload = (
  provider: ConnectionProvider | undefined,
  values: ConnectionConfig
) => {
  const payload: ConnectionConfig = {};

  if (!provider) return payload;

  provider.fields
    .filter((field) => field.type !== 'secret')
    .forEach((field) => {
      const value = values[field.id];
      if (value === undefined) {
        return;
      }

      if (typeof value === 'string' && value.trim() === '') {
        return;
      }

      payload[field.id] = value;
    });

  return payload;
};

export function ConnectionDetail({
  mode,
  connection,
  providers,
  isBusy,
  onCreate,
  onUpdate,
  onDelete,
  onReplaceSecret,
}: ConnectionDetailProps) {
  const initialProviderId =
    mode === 'create' ? providers[0]?.id ?? '' : connection?.metadata.providerId ?? '';
  const initialProvider = providers.find((item) => item.id === initialProviderId);

  const [providerId, setProviderId] = useState(initialProviderId);
  const [scope, setScope] = useState<ConnectionScope>(
    mode === 'view' && connection ? connection.metadata.scope : 'user'
  );
  const [displayName, setDisplayName] = useState(
    mode === 'view' && connection
      ? connection.metadata.displayName
      : initialProvider?.name ?? ''
  );
  const [configValues, setConfigValues] = useState<ConnectionConfig>(
    buildInitialConfig(
      initialProvider,
      mode === 'view' && connection ? connection.config : undefined
    )
  );
  const [secretValue, setSecretValue] = useState('');
  const [replaceSecretValue, setReplaceSecretValue] = useState('');

  const provider = useMemo(
    () => providers.find((item) => item.id === providerId),
    [providers, providerId]
  );

  const secretField = useMemo(
    () => provider?.fields.find((field) => field.type === 'secret') ?? null,
    [provider]
  );

  const handleProviderChange = (nextProviderId: string) => {
    setProviderId(nextProviderId);
    const nextProvider = providers.find((item) => item.id === nextProviderId);
    setConfigValues(buildInitialConfig(nextProvider));
    setSecretValue('');
    setReplaceSecretValue('');
    setDisplayName((current) =>
      current.trim().length > 0 ? current : nextProvider?.name ?? ''
    );
  };

  const handleConfigChange = useCallback((fieldId: string, value: string | number | boolean) => {
    setConfigValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!provider) return;

    await onCreate({
      providerId,
      scope,
      displayName: displayName.trim(),
      config: buildConfigPayload(provider, configValues),
      secretValue: secretValue.trim() || undefined,
    });

    setSecretValue('');
  }, [configValues, displayName, onCreate, provider, providerId, scope, secretValue]);

  const handleUpdate = useCallback(async () => {
    if (!provider || !connection) return;

    await onUpdate(connection.metadata.id, {
      providerId,
      scope,
      displayName: displayName.trim(),
      config: buildConfigPayload(provider, configValues),
    });
  }, [configValues, connection, displayName, onUpdate, provider, providerId, scope]);

  const handleDelete = useCallback(async () => {
    if (!connection) return;
    await onDelete(connection.metadata.id);
  }, [connection, onDelete]);

  const handleReplaceSecret = useCallback(async () => {
    if (!connection) return;

    const trimmed = replaceSecretValue.trim();
    if (!trimmed) return;

    await onReplaceSecret(connection.metadata.id, trimmed);
    setReplaceSecretValue('');
  }, [connection, onReplaceSecret, replaceSecretValue]);

  const renderConfigField = (field: ConnectionField) => {
    const fieldValue = configValues[field.id] ?? getDefaultConfigValue(field);

    if (field.type === 'boolean') {
      return (
        <ToggleSwitch
          checked={Boolean(fieldValue)}
          onChange={(next) => handleConfigChange(field.id, next)}
          label={field.label}
        />
      );
    }

    if (field.type === 'select') {
      const options = field.options?.map((option) => ({
        value: option.value,
        label: option.label ?? option.value,
      })) ?? [];

      return (
        <Select
          value={String(fieldValue ?? '')}
          onChange={(next) => handleConfigChange(field.id, next)}
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
          onChange={(next) => handleConfigChange(field.id, next)}
          min={0}
          className={fieldClassName}
        />
      );
    }

    return (
      <Input
        type="text"
        value={fieldValue as string | number}
        onChange={(next) => handleConfigChange(field.id, next)}
        placeholder={field.placeholder}
        className={fieldClassName}
      />
    );
  };

  if (!providers.length) {
    return (
      <div className="flex-1 p-6 text-sm text-secondary">
        No connection providers are registered yet.
      </div>
    );
  }

  if (mode === 'view' && !connection) {
    return (
      <div className="flex-1 p-6 text-sm text-secondary">
        Select a connection to view details.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-surface">
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
          {mode === 'create' ? 'New connection' : 'Connection details'}
        </div>
        <div className="text-[11px] text-secondary">
          Secrets are stored securely and never shown after saving.
        </div>
        {mode === 'view' && connection && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy}
            className="mt-2 text-xs font-semibold text-status-error hover:text-status-error/80 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

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
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-primary mb-1">
                Provider
              </label>
              {mode === 'create' ? (
                <ProviderPicker
                  providers={providers}
                  value={providerId}
                  onChange={handleProviderChange}
                  className={fieldClassName}
                />
              ) : (
                <div className="text-sm text-secondary">
                  {provider?.name ?? connection?.metadata.providerId}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-primary mb-1">
                Display name
              </label>
              <Input
                type="text"
                value={displayName}
                onChange={(next) => setDisplayName(String(next))}
                placeholder="My connection"
                className={fieldClassName}
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-primary mb-1">
                Scope
              </label>
              {mode === 'create' ? (
                <Select
                  value={scope}
                  onChange={(next) => setScope(next as ConnectionScope)}
                  options={[
                    { value: 'user', label: 'User' },
                    { value: 'workspace', label: 'Workspace' },
                  ]}
                  className={fieldClassName}
                />
              ) : (
                <div className="text-sm text-secondary capitalize">
                  {connection?.metadata.scope}
                </div>
              )}
            </div>
          </div>

        {provider && (
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
        )}

        {secretField && (
          <div>
            <h4 className="text-[13px] font-semibold text-primary mb-3">
              {mode === 'create' ? 'Secret' : 'Replace secret'}
            </h4>
            {mode === 'view' && connection?.metadata.secretRef && (
              <div className="text-[11px] text-secondary mb-2">
                A secret is stored for this connection.
              </div>
            )}
            <input
              type="password"
              value={mode === 'create' ? secretValue : replaceSecretValue}
              onChange={(event) =>
                mode === 'create'
                  ? setSecretValue(event.target.value)
                  : setReplaceSecretValue(event.target.value)
              }
              placeholder={secretField.placeholder ?? secretField.label}
              className={inputClassName}
            />
            <div className="mt-3">
              {mode === 'create' ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isBusy || !displayName.trim()}
                  className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-sm hover:bg-accent-hover disabled:opacity-50"
                >
                  Create connection
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReplaceSecret}
                  disabled={isBusy || !replaceSecretValue.trim()}
                  className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-sm hover:bg-accent-hover disabled:opacity-50"
                >
                  Replace secret
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'view' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isBusy || !displayName.trim()}
              className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-sm hover:bg-accent-hover disabled:opacity-50"
            >
              Save changes
            </button>
          </div>
        )}

        {mode === 'create' && !secretField && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isBusy || !displayName.trim()}
              className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-sm hover:bg-accent-hover disabled:opacity-50"
            >
              Create connection
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
