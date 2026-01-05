import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  AgentEventSchema,
  AgentRunMetadataSchema,
  ListAgentTraceRequestSchema,
  type AgentEvent,
  type AgentRunMetadata,
  type AgentRunSource,
  type AgentRunStatus,
  type ListAgentTraceRequest,
  type ListAgentTraceResponse,
} from 'packages-api-contracts';

type AgentRunStoreData = {
  version: 1;
  runs: Record<string, AgentRunMetadata>;
  events: Record<string, AgentEvent[]>;
};

const MAX_EVENTS_PER_RUN = 200;

const EMPTY_STORE: AgentRunStoreData = {
  version: 1,
  runs: {},
  events: {},
};

/**
 * AgentRunStore - persists agent run metadata and trace events.
 * 
 * Notes:
 * - Events are validated and unknown fields are stripped.
 * - Retention is capped per-run to avoid unbounded growth.
 */
export class AgentRunStore {
  private static instance: AgentRunStore | null = null;
  private readonly storePath: string;

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'agent-runs.json');
  }

  public static getInstance(): AgentRunStore {
    if (!AgentRunStore.instance) {
      AgentRunStore.instance = new AgentRunStore();
    }
    return AgentRunStore.instance;
  }

  public listRuns(): AgentRunMetadata[] {
    const store = this.loadStore();
    return Object.values(store.runs);
  }

  public getRun(runId: string): AgentRunMetadata | undefined {
    const store = this.loadStore();
    return store.runs[runId];
  }

  public createRun(source: AgentRunSource): AgentRunMetadata {
    const now = new Date().toISOString();
    const run = AgentRunMetadataSchema.parse({
      id: randomUUID(),
      status: 'queued',
      source,
      createdAt: now,
      updatedAt: now,
    });

    const store = this.loadStore();
    store.runs[run.id] = run;
    store.events[run.id] = [];
    this.saveStore(store);
    return run;
  }

  public updateRunStatus(runId: string, status: AgentRunStatus): AgentRunMetadata {
    const store = this.loadStore();
    const existing = store.runs[runId];
    if (!existing) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    const updated = AgentRunMetadataSchema.parse({
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    });

    store.runs[runId] = updated;
    this.saveStore(store);
    return updated;
  }

  public updateRunRouting(
    runId: string,
    routing: AgentRunMetadata['routing']
  ): AgentRunMetadata {
    const store = this.loadStore();
    const existing = store.runs[runId];
    if (!existing) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    const updated = AgentRunMetadataSchema.parse({
      ...existing,
      routing,
      updatedAt: new Date().toISOString(),
    });

    store.runs[runId] = updated;
    this.saveStore(store);
    return updated;
  }

  public appendEvent(event: AgentEvent): void {
    // Redact sensitive fields before persisting (P2: Security defaults)
    const redacted = this.redactEvent(event);
    const validated = AgentEventSchema.parse(redacted);
    const store = this.loadStore();
    if (!store.runs[validated.runId]) {
      throw new Error(`Agent run not found: ${validated.runId}`);
    }

    const events = store.events[validated.runId] ?? [];
    events.push(validated);
    if (events.length > MAX_EVENTS_PER_RUN) {
      events.splice(0, events.length - MAX_EVENTS_PER_RUN);
    }
    store.events[validated.runId] = events;
    this.saveStore(store);
  }

  public resetRunEvents(runId: string): void {
    const store = this.loadStore();
    if (!store.runs[runId]) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    store.events[runId] = [];
    this.saveStore(store);
  }

  public listEvents(request: ListAgentTraceRequest): ListAgentTraceResponse {
    const validated = ListAgentTraceRequestSchema.parse(request);
    const store = this.loadStore();
    const events = store.events[validated.runId] ?? [];
    const limit = validated.limit ?? 200;
    const cursor = validated.cursor ? parseInt(validated.cursor, 10) : 0;
    const start = Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
    const slice = events.slice(start, start + limit);
    const nextCursor = start + limit < events.length ? String(start + limit) : undefined;

    return { events: slice, nextCursor };
  }

  private loadStore(): AgentRunStoreData {
    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<AgentRunStoreData>;
      if (!parsed || typeof parsed !== 'object') {
        return { ...EMPTY_STORE };
      }
      return {
        version: 1,
        runs: parsed.runs ?? {},
        events: parsed.events ?? {},
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  private redactEvent(event: AgentEvent): AgentEvent {
    // Redact sensitive fields from tool calls and results
    if (event.type === 'tool-call') {
      return {
        ...event,
        toolCall: {
          ...event.toolCall,
          input: this.redactSensitiveData(event.toolCall.input) as typeof event.toolCall.input,
        },
      };
    }

    if (event.type === 'tool-result') {
      return {
        ...event,
        result: {
          ...event.result,
          output: event.result.output
            ? (this.redactSensitiveData(event.result.output) as typeof event.result.output)
            : undefined,
        },
      };
    }

    return event;
  }

  private redactSensitiveData(data: unknown): unknown {
    // Basic redaction for sensitive fields (P2: Security defaults)
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const redacted: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('key') && !lowerKey.includes('keyname')
        ) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = this.redactSensitiveData(value);
        } else {
          redacted[key] = value;
        }
      }

      return redacted;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitiveData(item));
    }

    return data;
  }

  private saveStore(store: AgentRunStoreData): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }
}

export const agentRunStore = AgentRunStore.getInstance();
