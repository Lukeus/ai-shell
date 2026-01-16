import path from 'path';
import {
  McpServerContributionSchema,
  type ExtensionManifest,
  type McpServerEnvMapping,
} from 'packages-api-contracts';

export type ExtensionSnapshot = {
  manifest: ExtensionManifest;
  extensionPath: string;
  enabled: boolean;
};

export type McpServerDefinition = {
  extensionId: string;
  serverId: string;
  name: string;
  transport: 'stdio';
  command: string;
  args: string[];
  env?: McpServerEnvMapping;
  connectionProviderId?: string;
  extensionPath: string;
};

export const buildMcpServerKey = (extensionId: string, serverId: string): string =>
  `${extensionId}:${serverId}`;

const isPathLike = (value: string): boolean =>
  value.startsWith('.') || value.includes('/') || value.includes('\\');

const resolveCommand = (command: string, extensionPath: string): string => {
  if (path.isAbsolute(command)) {
    return command;
  }
  if (!isPathLike(command)) {
    return command;
  }
  return path.resolve(extensionPath, command);
};

const buildDefinition = (
  extension: ExtensionSnapshot,
  server: unknown
): McpServerDefinition | null => {
  const parsed = McpServerContributionSchema.safeParse(server);
  if (!parsed.success) {
    return null;
  }

  return {
    extensionId: extension.manifest.id,
    serverId: parsed.data.id,
    name: parsed.data.name,
    transport: parsed.data.transport,
    command: resolveCommand(parsed.data.command, extension.extensionPath),
    args: parsed.data.args ?? [],
    env: parsed.data.env,
    connectionProviderId: parsed.data.connectionProviderId,
    extensionPath: extension.extensionPath,
  };
};

export const getMcpServerDefinitions = (
  extensions: ExtensionSnapshot[]
): Map<string, McpServerDefinition> => {
  const definitions = new Map<string, McpServerDefinition>();

  for (const extension of extensions) {
    if (!extension.enabled) {
      continue;
    }
    const servers = extension.manifest.contributes?.mcpServers ?? [];
    for (const server of servers) {
      const def = buildDefinition(extension, server);
      if (def) {
        definitions.set(buildMcpServerKey(def.extensionId, def.serverId), def);
      }
    }
  }

  return definitions;
};
