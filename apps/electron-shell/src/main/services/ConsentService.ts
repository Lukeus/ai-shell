import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type ConsentDecision = 'allow-once' | 'allow-always' | 'deny';

type ConsentRecord = {
  connectionId: string;
  requesterId: string;
  decision: ConsentDecision;
  createdAt: string;
};

type ConsentStore = {
  version: 1;
  decisions: Record<string, ConsentRecord>;
};

const EMPTY_STORE: ConsentStore = {
  version: 1,
  decisions: {},
};

const decisionKey = (connectionId: string, requesterId: string) =>
  `${connectionId}::${requesterId}`;

/**
 * ConsentService - stores secret access decisions per connection + requester.
 * 
 * Decisions are stored as allow-once, allow-always, or deny.
 */
export class ConsentService {
  private static instance: ConsentService | null = null;
  private readonly consentPath: string;

  private constructor() {
    this.consentPath = path.join(app.getPath('userData'), 'consent.json');
  }

  public static getInstance(): ConsentService {
    if (!ConsentService.instance) {
      ConsentService.instance = new ConsentService();
    }
    return ConsentService.instance;
  }

  public recordDecision(
    connectionId: string,
    requesterId: string,
    decision: ConsentDecision
  ): ConsentRecord {
    const store = this.loadStore();
    const record: ConsentRecord = {
      connectionId,
      requesterId,
      decision,
      createdAt: new Date().toISOString(),
    };

    store.decisions[decisionKey(connectionId, requesterId)] = record;
    this.saveStore(store);
    return record;
  }

  public getDecision(connectionId: string, requesterId: string): ConsentDecision | null {
    const store = this.loadStore();
    const record = store.decisions[decisionKey(connectionId, requesterId)];
    return record ? record.decision : null;
  }

  public evaluateAccess(connectionId: string, requesterId: string): boolean | null {
    const store = this.loadStore();
    const key = decisionKey(connectionId, requesterId);
    const record = store.decisions[key];
    if (!record) {
      return null;
    }

    if (record.decision === 'allow-once') {
      delete store.decisions[key];
      this.saveStore(store);
      return true;
    }

    return record.decision === 'allow-always';
  }

  public clearDecision(connectionId: string, requesterId: string): void {
    const store = this.loadStore();
    const key = decisionKey(connectionId, requesterId);
    if (!store.decisions[key]) {
      return;
    }
    delete store.decisions[key];
    this.saveStore(store);
  }

  private loadStore(): ConsentStore {
    try {
      const content = fs.readFileSync(this.consentPath, 'utf-8');
      const parsed = JSON.parse(content) as ConsentStore;
      if (!parsed || typeof parsed !== 'object' || !parsed.decisions) {
        return { ...EMPTY_STORE };
      }
      return {
        version: 1,
        decisions: { ...parsed.decisions },
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  private saveStore(store: ConsentStore): void {
    const dir = path.dirname(this.consentPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.consentPath, JSON.stringify(store, null, 2), 'utf-8');
  }
}

export const consentService = ConsentService.getInstance();
