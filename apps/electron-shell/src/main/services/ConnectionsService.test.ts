import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionsService } from './ConnectionsService';
import * as fs from 'fs';
import * as path from 'path';

const mockUserDataPath = 'C:\\mock\\userdata';
const mockConnectionsPath = path.join(mockUserDataPath, 'connections.json');

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('ConnectionsService', () => {
  let service: ConnectionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Reset singleton for tests
    ConnectionsService.instance = null;
    service = ConnectionsService.getInstance();
  });

  it('creates and lists connections', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const created = service.createConnection({
      providerId: 'mcp',
      scope: 'user',
      displayName: 'My MCP',
      config: { host: 'localhost', port: 8080 },
    });

    expect(created.metadata.id).toBeDefined();
    expect(created.metadata.displayName).toBe('My MCP');
    expect(created.config.host).toBe('localhost');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockConnectionsPath,
      expect.any(String),
      'utf-8'
    );

    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    const list = service.listConnections();
    expect(list).toHaveLength(1);
    expect(list[0].metadata.id).toBe(created.metadata.id);
  });

  it('updates connection metadata and config', () => {
    const existing = service.createConnection({
      providerId: 'mcp',
      scope: 'user',
      displayName: 'Old Name',
      config: { host: 'localhost' },
    });

    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    const updated = service.updateConnection({
      id: existing.metadata.id,
      displayName: 'New Name',
      config: { host: '127.0.0.1', ssl: true },
    });

    expect(updated.metadata.displayName).toBe('New Name');
    expect(updated.config.host).toBe('127.0.0.1');
    expect(updated.config.ssl).toBe(true);
  });

  it('sets secretRef on metadata without storing secret value', () => {
    const created = service.createConnection({
      providerId: 'mcp',
      scope: 'workspace',
      displayName: 'With Secret',
      config: { host: 'localhost' },
    });

    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    const updated = service.setSecretRef(created.metadata.id, 'secret-ref-1');
    expect(updated.metadata.secretRef).toBe('secret-ref-1');
    expect(JSON.stringify(updated)).not.toContain('secretValue');
  });

  it('deletes connections', () => {
    const created = service.createConnection({
      providerId: 'mcp',
      scope: 'user',
      displayName: 'To Delete',
      config: { host: 'localhost' },
    });

    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    service.deleteConnection(created.metadata.id);
    const list = service.listConnections();
    expect(list).toHaveLength(0);
  });

  it('rejects invalid config values', () => {
    expect(() =>
      service.createConnection({
        providerId: 'mcp',
        scope: 'user',
        displayName: 'Bad',
        config: { nested: { bad: true } as any },
      })
    ).toThrow();
  });
});
