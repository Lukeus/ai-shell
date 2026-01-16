import type {
  Connection,
  McpServerEnvMapping,
  McpServerSettings,
  Settings,
} from 'packages-api-contracts';
import type { McpServerDefinition } from './mcp-server-definitions';

export const getMcpServerSettings = (
  settings: Settings,
  key: string
): McpServerSettings => {
  return settings.mcp.servers[key] ?? { enabled: false, connectionId: null };
};

export const resolveMcpConnection = (
  def: McpServerDefinition,
  settings: Settings,
  key: string,
  connections: Connection[]
): { connection: Connection | null; error?: string } => {
  const needsConnection = Boolean(def.connectionProviderId || def.env);
  if (!needsConnection) {
    return { connection: null };
  }

  const serverSettings = getMcpServerSettings(settings, key);
  const connectionId = serverSettings.connectionId;
  if (!connectionId) {
    return { connection: null, error: 'Connection required for MCP server.' };
  }

  const connection = connections.find((item) => item.metadata.id === connectionId);
  if (!connection) {
    return { connection: null, error: `Connection not found: ${connectionId}` };
  }

  if (def.connectionProviderId && connection.metadata.providerId !== def.connectionProviderId) {
    return { connection: null, error: 'Selected connection does not match provider.' };
  }

  return { connection };
};

export const resolveMcpEnv = (
  envMapping: McpServerEnvMapping | undefined,
  connection: Connection | null,
  getSecret: (secretRef: string) => string
): { env: Record<string, string>; error?: string } => {
  if (!envMapping || Object.keys(envMapping).length === 0) {
    return { env: {} };
  }

  if (!connection) {
    return { env: {}, error: 'Connection required for environment mapping.' };
  }

  const env: Record<string, string> = {};

  for (const [envKey, source] of Object.entries(envMapping)) {
    if (source.source === 'config') {
      const configKey = source.key ?? envKey;
      const value = connection.config[configKey];
      if (value === undefined || value === null) {
        return { env: {}, error: `Missing config value for ${configKey}.` };
      }
      env[envKey] = String(value);
      continue;
    }

    const secretRef = connection.metadata.secretRef;
    if (!secretRef) {
      return { env: {}, error: 'Connection secret not configured.' };
    }

    try {
      env[envKey] = getSecret(secretRef);
    } catch {
      return { env: {}, error: 'Failed to load connection secret.' };
    }
  }

  return { env };
};
