import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import {
  SettingsSchema,
  SETTINGS_DEFAULTS,
  type Connection,
  type PartialSettings,
} from 'packages-api-contracts';
import { McpServerManager } from './McpServerManager';
import type { ExtensionSnapshot } from './mcp-server-definitions';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('../index', () => ({
  getExtensionRegistry: vi.fn(() => null),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\temp'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString()),
  },
}));

vi.mock('child_process', async () => {
  return {
    spawn: mockSpawn,
    default: {
      spawn: mockSpawn,
    },
  };
});

vi.mock('node:child_process', async () => {
  return {
    spawn: mockSpawn,
    default: {
      spawn: mockSpawn,
    },
  };
});

class FakeChildProcess extends EventEmitter {
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public killed = false;
  public kill = vi.fn(() => {
    this.killed = true;
    this.emit('exit', 0, null);
    return true;
  });
}

const serverId = 'sample.mcp';
const extensionId = 'acme.sample-extension';
const serverKey = `${extensionId}:${serverId}`;

const extension: ExtensionSnapshot = {
  manifest: {
    id: extensionId,
    name: 'Sample Extension',
    version: '1.0.0',
    publisher: 'acme',
    main: 'index.js',
    activationEvents: [],
    permissions: [],
    contributes: {
      mcpServers: [
        {
          id: serverId,
          name: 'Sample MCP',
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: {
            API_HOST: { source: 'config', key: 'host' },
            API_KEY: { source: 'secret' },
          },
          connectionProviderId: 'openai',
        },
      ],
    },
  },
  extensionPath: 'C:\\extensions\\sample',
  enabled: true,
};

const connection: Connection = {
  metadata: {
    id: '11111111-1111-1111-1111-111111111111',
    providerId: 'openai',
    scope: 'user',
    displayName: 'OpenAI',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    secretRef: 'secret-ref-1',
  },
  config: {
    host: 'api.example.com',
  },
};

const deepMerge = (target: any, source: any): any => {
  if (typeof source !== 'object' || source === null) {
    return source;
  }
  if (typeof target !== 'object' || target === null) {
    return source;
  }
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];
    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
};

const createManager = (withConnection: boolean) => {
  let settings = SettingsSchema.parse(SETTINGS_DEFAULTS);
  if (withConnection) {
    settings = SettingsSchema.parse(
      deepMerge(settings, { mcp: { servers: { [serverKey]: { connectionId: connection.metadata.id } } } })
    );
  }

  const updateSettings = (updates: PartialSettings) => {
    settings = SettingsSchema.parse(deepMerge(settings, updates));
    return settings;
  };

  const manager = new McpServerManager({
    getExtensions: () => [extension],
    getSettings: () => settings,
    updateSettings,
    listConnections: () => [connection],
    getSecret: () => 'secret-value',
    buildEnv: (options?: { extra?: Record<string, string | undefined> }) =>
      (options?.extra ?? {}) as Record<string, string>,
    now: () => '2026-01-01T00:00:00.000Z',
  });

  return { manager, getSettings: () => settings };
};

describe('McpServerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists MCP servers with default status', () => {
    const { manager } = createManager(false);
    const result = manager.listServers();

    expect(result.servers).toHaveLength(1);
    expect(result.servers[0].enabled).toBe(false);
    expect(result.servers[0].status.state).toBe('stopped');
  });

  it('starts MCP servers with resolved env and enables settings', async () => {
    const { manager, getSettings } = createManager(true);
    const child = new FakeChildProcess();
    mockSpawn.mockReturnValue(child as any);

    const status = await manager.startServer({ extensionId, serverId });

    expect(status.state).toBe('starting');
    expect(mockSpawn).toHaveBeenCalledWith(
      'node',
      ['server.js'],
      expect.objectContaining({
        cwd: extension.extensionPath,
        env: expect.objectContaining({
          API_HOST: 'api.example.com',
          API_KEY: 'secret-value',
        }),
      })
    );

    child.emit('spawn');
    expect(manager.getStatus({ extensionId, serverId }).state).toBe('running');
    expect(getSettings().mcp.servers[serverKey].enabled).toBe(true);
  });

  it('stops MCP servers and disables settings', async () => {
    const { manager, getSettings } = createManager(true);
    const child = new FakeChildProcess();
    mockSpawn.mockReturnValue(child as any);

    await manager.startServer({ extensionId, serverId });
    child.emit('spawn');

    await manager.stopServer({ extensionId, serverId });

    expect(manager.getStatus({ extensionId, serverId }).state).toBe('stopped');
    expect(getSettings().mcp.servers[serverKey].enabled).toBe(false);
  });
});
