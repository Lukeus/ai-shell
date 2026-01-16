import { useCallback, useMemo, useState } from 'react';
import type { ConnectionConfig, ConnectionScope } from 'packages-api-contracts';
import type {
  ConnectionDetailProps,
  ConnectionDetailViewProps,
} from './ConnectionDetail.types';
import {
  buildConfigPayload,
  buildInitialConfig,
  getMissingRequiredFields,
} from './ConnectionDetail.utils';

export function useConnectionDetail({
  mode,
  connection,
  providers,
  isBusy,
  onCreate,
  onUpdate,
  onDelete,
  onReplaceSecret,
}: ConnectionDetailProps): ConnectionDetailViewProps {
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

  const missingRequiredFields = useMemo(
    () => getMissingRequiredFields(provider, configValues),
    [provider, configValues]
  );

  const requiresSecret = Boolean(secretField?.required);
  const hasStoredSecret = Boolean(connection?.metadata.secretRef);
  const secretInput = mode === 'create' ? secretValue : replaceSecretValue;
  const hasSecretInput = secretInput.trim().length > 0;
  const secretSatisfied =
    !requiresSecret || (mode === 'create' ? hasSecretInput : hasStoredSecret || hasSecretInput);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    if (missingRequiredFields.length > 0) {
      messages.push(
        `Required fields: ${missingRequiredFields
          .map((field) => field.label || field.id)
          .join(', ')}`
      );
    }
    if (!secretSatisfied) {
      messages.push('Secret is required for this connection.');
    }
    return messages;
  }, [missingRequiredFields, secretSatisfied]);

  const canSubmit = displayName.trim().length > 0 && validationMessages.length === 0;

  const handleProviderChange = useCallback(
    (nextProviderId: string) => {
      setProviderId(nextProviderId);
      const nextProvider = providers.find((item) => item.id === nextProviderId);
      setConfigValues(buildInitialConfig(nextProvider));
      setSecretValue('');
      setReplaceSecretValue('');
      setDisplayName((current) =>
        current.trim().length > 0 ? current : nextProvider?.name ?? ''
      );
    },
    [providers]
  );

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

  return {
    state: {
      mode,
      connection,
      providers,
      provider,
      providerId,
      scope,
      displayName,
      configValues,
      secretValue,
      replaceSecretValue,
      secretField,
      validationMessages,
      canSubmit,
      isBusy,
    },
    actions: {
      onProviderChange: handleProviderChange,
      onScopeChange: setScope,
      onDisplayNameChange: setDisplayName,
      onConfigChange: handleConfigChange,
      onSecretChange: setSecretValue,
      onReplaceSecretChange: setReplaceSecretValue,
      onCreate: handleCreate,
      onUpdate: handleUpdate,
      onDelete: handleDelete,
      onReplaceSecret: handleReplaceSecret,
    },
  };
}
