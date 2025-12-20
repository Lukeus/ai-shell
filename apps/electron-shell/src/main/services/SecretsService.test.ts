import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecretsService } from './SecretsService';
import * as fs from 'fs';
import * as path from 'path';

const mockUserDataPath = 'C:\\mock\\userdata';
const mockSecretsPath = path.join(mockUserDataPath, 'secrets.json');

let encryptedValue = '';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => {
      encryptedValue = `enc:${value}`;
      return Buffer.from(encryptedValue);
    }),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString('utf-8').replace('enc:', '')),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('SecretsService', () => {
  let service: SecretsService;

  beforeEach(() => {
    vi.clearAllMocks();
    encryptedValue = '';
    // @ts-expect-error Reset singleton for tests
    SecretsService.instance = null;
    service = SecretsService.getInstance();
  });

  it('throws when safeStorage is unavailable', () => {
    const { safeStorage } = require('electron');
    safeStorage.isEncryptionAvailable.mockReturnValue(false);

    expect(() => service.setSecret('conn-1', 'top-secret')).toThrow(
      'safeStorage encryption is not available'
    );
  });

  it('stores encrypted secret data only', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const secretRef = service.setSecret('conn-1', 'top-secret');

    expect(secretRef).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    const expectedCiphertext = Buffer.from('enc:top-secret').toString('base64');
    expect(encryptedValue).toBe('enc:top-secret');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockSecretsPath,
      expect.stringContaining(expectedCiphertext),
      'utf-8'
    );

    const stored = JSON.parse(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );
    expect(JSON.stringify(stored)).not.toContain('top-secret');
  });

  it('decrypts secret when requested', () => {
    const ciphertext = Buffer.from('enc:super-secret').toString('base64');
    const store = {
      version: 1,
      secrets: {
        'secret-ref': {
          secretRef: 'secret-ref',
          connectionId: 'conn-1',
          ciphertext,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(store));

    const value = service.getSecret('secret-ref');
    expect(value).toBe('super-secret');
  });

  it('reuses existing secretRef when replacing secret for same connection', () => {
    const ciphertext = Buffer.from('enc:old-secret').toString('base64');
    const store = {
      version: 1,
      secrets: {
        'secret-ref': {
          secretRef: 'secret-ref',
          connectionId: 'conn-1',
          ciphertext,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(store));
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const secretRef = service.replaceSecret('conn-1', 'new-secret');
    expect(secretRef).toBe('secret-ref');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
