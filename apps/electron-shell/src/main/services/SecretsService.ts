import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

type SecretRecord = {
  secretRef: string;
  connectionId: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
};

type SecretsStore = {
  version: 1;
  secrets: Record<string, SecretRecord>;
};

const EMPTY_STORE: SecretsStore = {
  version: 1,
  secrets: {},
};

/**
 * SecretsService - Singleton service for storing encrypted secrets.
 * 
 * All secrets are encrypted using Electron safeStorage and stored as ciphertext
 * in a local JSON store. Plaintext secrets are never persisted or logged.
 */
export class SecretsService {
  private static instance: SecretsService | null = null;
  private readonly secretsPath: string;

  private constructor() {
    this.secretsPath = path.join(app.getPath('userData'), 'secrets.json');
  }

  public static getInstance(): SecretsService {
    if (!SecretsService.instance) {
      SecretsService.instance = new SecretsService();
    }
    return SecretsService.instance;
  }

  public setSecret(connectionId: string, secretValue: string): string {
    this.ensureEncryptionAvailable();

    const store = this.loadStore();
    const secretRef = randomUUID();
    const now = new Date().toISOString();
    const ciphertext = safeStorage.encryptString(secretValue).toString('base64');

    store.secrets[secretRef] = {
      secretRef,
      connectionId,
      ciphertext,
      createdAt: now,
      updatedAt: now,
    };

    this.saveStore(store);
    return secretRef;
  }

  public replaceSecret(connectionId: string, secretValue: string): string {
    this.ensureEncryptionAvailable();

    const store = this.loadStore();
    const now = new Date().toISOString();
    const ciphertext = safeStorage.encryptString(secretValue).toString('base64');

    const existing = Object.values(store.secrets).find(
      (record) => record.connectionId === connectionId
    );

    if (existing) {
      store.secrets[existing.secretRef] = {
        ...existing,
        ciphertext,
        updatedAt: now,
      };
      this.saveStore(store);
      return existing.secretRef;
    }

    const secretRef = randomUUID();
    store.secrets[secretRef] = {
      secretRef,
      connectionId,
      ciphertext,
      createdAt: now,
      updatedAt: now,
    };

    this.saveStore(store);
    return secretRef;
  }

  public getSecret(secretRef: string): string {
    this.ensureEncryptionAvailable();

    const store = this.loadStore();
    const record = store.secrets[secretRef];
    if (!record) {
      throw new Error(`Secret not found: ${secretRef}`);
    }

    const buffer = Buffer.from(record.ciphertext, 'base64');
    return safeStorage.decryptString(buffer);
  }

  public deleteSecret(secretRef: string): void {
    const store = this.loadStore();
    if (!store.secrets[secretRef]) {
      return;
    }

    delete store.secrets[secretRef];
    this.saveStore(store);
  }

  private ensureEncryptionAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage encryption is not available');
    }
  }

  private loadStore(): SecretsStore {
    try {
      const content = fs.readFileSync(this.secretsPath, 'utf-8');
      const parsed = JSON.parse(content) as SecretsStore;
      if (!parsed || typeof parsed !== 'object' || !parsed.secrets) {
        return { ...EMPTY_STORE };
      }
      return {
        version: 1,
        secrets: { ...parsed.secrets },
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  private saveStore(store: SecretsStore): void {
    const dir = path.dirname(this.secretsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.secretsPath, JSON.stringify(store, null, 2), 'utf-8');
  }
}

export const secretsService = SecretsService.getInstance();
