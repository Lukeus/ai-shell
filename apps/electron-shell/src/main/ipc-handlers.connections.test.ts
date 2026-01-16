import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { registerIPCHandlers } from './ipc-handlers';
import { connectionsService } from './services/ConnectionsService';
import { connectionProviderRegistry } from './services/ConnectionProviderRegistry';
import { secretsService } from './services/SecretsService';
import { consentService } from './services/ConsentService';
import { auditService } from './services/AuditService';
import { settingsService } from './services/SettingsService';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => 'C:\\temp'),
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('./ipc/agents', () => ({
  registerAgentHandlers: vi.fn(),
}));

vi.mock('./ipc/diagnostics', () => ({
  registerDiagnosticsHandlers: vi.fn(),
}));

vi.mock('./ipc/extensions', () => ({
  registerExtensionHandlers: vi.fn(),
}));

vi.mock('./ipc/mcp', () => ({
  registerMcpHandlers: vi.fn(),
}));

vi.mock('./ipc/testOnly', () => ({
  registerTestOnlyHandlers: vi.fn(),
}));

vi.mock('./index', () => ({
  getAgentHostManager: vi.fn(() => null),
  getExtensionCommandService: vi.fn(() => null),
  getExtensionRegistry: vi.fn(() => null),
  getExtensionViewService: vi.fn(() => null),
  getExtensionToolService: vi.fn(() => null),
  getPermissionService: vi.fn(() => null),
}));

vi.mock('./services/ConnectionsService', () => ({
  connectionsService: {
    listConnections: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    setSecretRef: vi.fn(),
  },
}));

vi.mock('./services/ConnectionProviderRegistry', () => ({
  connectionProviderRegistry: {
    list: vi.fn(),
  },
}));

vi.mock('./services/SecretsService', () => ({
  secretsService: {
    setSecret: vi.fn(),
    replaceSecret: vi.fn(),
  },
}));

vi.mock('./services/ConsentService', () => ({
  consentService: {
    evaluateAccess: vi.fn(),
    recordDecision: vi.fn(),
  },
}));

vi.mock('./services/AuditService', () => ({
  auditService: {
    logSecretAccess: vi.fn(),
    listEvents: vi.fn(),
  },
}));

vi.mock('./services/SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
  },
}));

vi.mock('./services/SddTraceService', () => ({
  sddTraceService: {
    onStatusChange: vi.fn(),
    setEnabled: vi.fn(),
  },
}));

vi.mock('./services/SddWatcher', () => ({
  sddWatcher: {
    setEnabled: vi.fn(),
  },
}));

vi.mock('./services/OutputService', () => ({
  outputService: {
    onAppend: vi.fn(() => vi.fn()),
    onClear: vi.fn(() => vi.fn()),
  },
}));

describe('IPC Handlers - Connections', () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    vi.mocked(settingsService.getSettings).mockReturnValue(SETTINGS_DEFAULTS);
    vi.mocked(sddTraceService.onStatusChange).mockReturnValue(() => undefined);
    vi.mocked(sddTraceService.setEnabled).mockResolvedValue(undefined);
    vi.mocked(sddWatcher.setEnabled).mockReturnValue(undefined);

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, handler);
      return ipcMain;
    });

    registerIPCHandlers();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  function getHandler(channel: string) {
    const handler = handlers.get(channel);
    expect(handler).toBeDefined();
    return handler!;
  }

  describe('Connections handlers', () => {
    it('should register CONNECTIONS_PROVIDERS_LIST handler', () => {
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST)).toBe(true);
    });

    it('should register CONNECTIONS_LIST handler', () => {
      expect(handlers.has(IPC_CHANNELS.CONNECTIONS_LIST)).toBe(true);
    });

    it('should list providers via ConnectionProviderRegistry', async () => {
      const providers = [
        {
          id: 'openai',
          name: 'OpenAI',
          fields: [],
        },
      ];

      vi.mocked(connectionProviderRegistry.list).mockReturnValue(providers);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST);
      const result = await handler();

      expect(connectionProviderRegistry.list).toHaveBeenCalled();
      expect(result).toEqual({ providers });
    });

    it('should list connections via ConnectionsService', async () => {
      const mockConnections = [
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'My Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          config: { host: 'localhost' },
        },
      ];
      vi.mocked(connectionsService.listConnections).mockReturnValue(mockConnections);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_LIST);
      const result = await handler();

      expect(connectionsService.listConnections).toHaveBeenCalled();
      expect(result).toEqual({ connections: mockConnections });
    });

    it('should create connection via ConnectionsService', async () => {
      const mockConnection = {
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          providerId: 'mcp',
          scope: 'user' as const,
          displayName: 'My Conn',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        config: { host: 'localhost' },
      };
      vi.mocked(connectionsService.createConnection).mockReturnValue(mockConnection);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_CREATE);
      const result = await handler(null, {
        providerId: 'mcp',
        scope: 'user' as const,
        displayName: 'My Conn',
        config: { host: 'localhost' },
      });

      expect(connectionsService.createConnection).toHaveBeenCalled();
      expect(result).toEqual({ connection: mockConnection });
    });

    it('should update connection via ConnectionsService', async () => {
      const mockConnection = {
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          providerId: 'mcp',
          scope: 'user' as const,
          displayName: 'Updated',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        config: { host: '127.0.0.1' },
      };
      vi.mocked(connectionsService.updateConnection).mockReturnValue(mockConnection);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_UPDATE);
      const result = await handler(null, {
        id: '123e4567-e89b-12d3-a456-426614174000',
        displayName: 'Updated',
        config: { host: '127.0.0.1' },
      });

      expect(connectionsService.updateConnection).toHaveBeenCalled();
      expect(result).toEqual({ connection: mockConnection });
    });

    it('should delete connection via ConnectionsService', async () => {
      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_DELETE);
      await handler(null, { id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(connectionsService.deleteConnection).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });

    it('should set secret and update connection metadata', async () => {
      vi.mocked(connectionsService.listConnections).mockReturnValue([
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          config: { host: 'localhost' },
        },
      ]);
      vi.mocked(secretsService.setSecret).mockReturnValue('secret-ref');

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_SET_SECRET);
      const result = await handler(null, {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        secretValue: 'secret',
      });

      expect(secretsService.setSecret).toHaveBeenCalled();
      expect(connectionsService.setSecretRef).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'secret-ref'
      );
      expect(result).toEqual({ secretRef: 'secret-ref' });
    });

    it('should replace secret and update connection metadata', async () => {
      vi.mocked(connectionsService.listConnections).mockReturnValue([
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          config: { host: 'localhost' },
        },
      ]);
      vi.mocked(secretsService.replaceSecret).mockReturnValue('secret-ref');

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_REPLACE_SECRET);
      const result = await handler(null, {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        secretValue: 'secret',
      });

      expect(secretsService.replaceSecret).toHaveBeenCalled();
      expect(connectionsService.setSecretRef).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'secret-ref'
      );
      expect(result).toEqual({ secretRef: 'secret-ref' });
    });

    it('should gate secret access via ConsentService', async () => {
      vi.mocked(consentService.evaluateAccess).mockReturnValue(true);
      vi.mocked(connectionsService.listConnections).mockReturnValue([
        {
          metadata: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            providerId: 'mcp',
            scope: 'user' as const,
            displayName: 'Conn',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            secretRef: 'secret-ref',
          },
          config: { host: 'localhost' },
        },
      ]);

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_REQUEST_SECRET_ACCESS);
      const result = await handler(null, {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        requesterId: 'ext-1',
      });

      expect(consentService.evaluateAccess).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'ext-1'
      );
      expect(auditService.logSecretAccess).toHaveBeenCalled();
      expect(result).toEqual({ granted: true, secretRef: 'secret-ref' });
    });

    it('should list audit events', async () => {
      vi.mocked(auditService.listEvents).mockReturnValue({
        events: [],
      });

      const handler = getHandler(IPC_CHANNELS.CONNECTIONS_AUDIT_LIST);
      const result = await handler(null, {});

      expect(auditService.listEvents).toHaveBeenCalled();
      expect(result).toEqual({ events: [] });
    });
  });
});
