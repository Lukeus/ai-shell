import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  ConnectionConfigSchema,
  ConnectionSchema,
  CreateConnectionRequestSchema,
  UpdateConnectionRequestSchema,
  type Connection,
  type CreateConnectionRequest,
  type UpdateConnectionRequest,
} from 'packages-api-contracts';

type ConnectionsStore = {
  version: 1;
  connections: Record<string, Connection>;
};

const EMPTY_STORE: ConnectionsStore = {
  version: 1,
  connections: {},
};

/**
 * ConnectionsService - stores connection metadata + non-secret config.
 * 
 * Secrets are stored separately via SecretsService and referenced by secretRef.
 */
export class ConnectionsService {
  private static instance: ConnectionsService | null = null;
  private readonly connectionsPath: string;

  private constructor() {
    this.connectionsPath = path.join(app.getPath('userData'), 'connections.json');
  }

  public static getInstance(): ConnectionsService {
    if (!ConnectionsService.instance) {
      ConnectionsService.instance = new ConnectionsService();
    }
    return ConnectionsService.instance;
  }

  public listConnections(): Connection[] {
    const store = this.loadStore();
    return Object.values(store.connections);
  }

  public createConnection(request: CreateConnectionRequest): Connection {
    const validated = CreateConnectionRequestSchema.parse(request);
    const config = ConnectionConfigSchema.parse(validated.config);
    const id = randomUUID();
    const now = new Date().toISOString();

    const connection: Connection = ConnectionSchema.parse({
      metadata: {
        id,
        providerId: validated.providerId,
        scope: validated.scope,
        displayName: validated.displayName,
        createdAt: now,
        updatedAt: now,
      },
      config,
    });

    const store = this.loadStore();
    store.connections[id] = connection;
    this.saveStore(store);
    return connection;
  }

  public updateConnection(request: UpdateConnectionRequest): Connection {
    const validated = UpdateConnectionRequestSchema.parse(request);
    const store = this.loadStore();
    const existing = store.connections[validated.id];
    if (!existing) {
      throw new Error(`Connection not found: ${validated.id}`);
    }

    const config = validated.config
      ? ConnectionConfigSchema.parse(validated.config)
      : existing.config;

    const updated: Connection = ConnectionSchema.parse({
      metadata: {
        ...existing.metadata,
        displayName: validated.displayName ?? existing.metadata.displayName,
        updatedAt: new Date().toISOString(),
      },
      config,
    });

    store.connections[validated.id] = updated;
    this.saveStore(store);
    return updated;
  }

  public deleteConnection(id: string): void {
    const store = this.loadStore();
    if (!store.connections[id]) {
      return;
    }
    delete store.connections[id];
    this.saveStore(store);
  }

  public setSecretRef(connectionId: string, secretRef: string | undefined): Connection {
    const store = this.loadStore();
    const existing = store.connections[connectionId];
    if (!existing) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const updated: Connection = ConnectionSchema.parse({
      metadata: {
        ...existing.metadata,
        secretRef,
        updatedAt: new Date().toISOString(),
      },
      config: existing.config,
    });

    store.connections[connectionId] = updated;
    this.saveStore(store);
    return updated;
  }

  private loadStore(): ConnectionsStore {
    try {
      const content = fs.readFileSync(this.connectionsPath, 'utf-8');
      const parsed = JSON.parse(content) as ConnectionsStore;
      if (!parsed || typeof parsed !== 'object' || !parsed.connections) {
        return { ...EMPTY_STORE };
      }
      return {
        version: 1,
        connections: { ...parsed.connections },
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  private saveStore(store: ConnectionsStore): void {
    const dir = path.dirname(this.connectionsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.connectionsPath, JSON.stringify(store, null, 2), 'utf-8');
  }
}

export const connectionsService = ConnectionsService.getInstance();
