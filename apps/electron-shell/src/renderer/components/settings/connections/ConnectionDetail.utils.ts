import type { ConnectionConfig, ConnectionField, ConnectionProvider } from 'packages-api-contracts';

export const getDefaultConfigValue = (field: ConnectionField) => {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  if (field.type === 'boolean') {
    return false;
  }

  return '';
};

export const buildInitialConfig = (
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

export const buildConfigPayload = (
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

const hasRequiredValue = (
  field: ConnectionField,
  value: ConnectionConfig[string] | undefined
): boolean => {
  if (field.type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (field.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  return typeof value === 'string' && value.trim().length > 0;
};

export const getMissingRequiredFields = (
  provider: ConnectionProvider | undefined,
  values: ConnectionConfig
): ConnectionField[] => {
  if (!provider) {
    return [];
  }

  return provider.fields.filter(
    (field) =>
      field.required &&
      field.type !== 'secret' &&
      !hasRequiredValue(field, values[field.id])
  );
};
