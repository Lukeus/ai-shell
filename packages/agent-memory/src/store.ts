import { randomUUID } from 'crypto';
import type { JsonValue } from 'packages-api-contracts';

export type AgentMemoryConfig = {
  maxEntries?: number;
  maxBytes?: number;
};

export type AgentMemoryEntry = {
  id: string;
  timestamp: string;
  data: JsonValue;
  bytes: number;
};

export type AgentMemorySnapshot = {
  runId: string;
  entries: AgentMemoryEntry[];
  totalBytes: number;
  maxEntries: number;
  maxBytes: number;
};

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_BYTES = 256 * 1024;

const normalizeLimit = (value: number | undefined, fallback: number): number => {
  if (!value || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
};

const coerceJsonValue = (value: unknown, seen: WeakSet<object>): JsonValue => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => coerceJsonValue(item, seen));
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) {
      return '[circular]';
    }
    seen.add(objectValue);

    const record: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(objectValue)) {
      record[key] = coerceJsonValue(entry, seen);
    }

    seen.delete(objectValue);
    return record;
  }

  return String(value);
};

const sanitizeEntry = (value: unknown): JsonValue => {
  return coerceJsonValue(value, new WeakSet());
};

const getEntryBytes = (value: JsonValue): number => {
  const serialized = JSON.stringify(value);
  return Buffer.byteLength(serialized, 'utf8');
};

export class AgentMemoryStore {
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly runs = new Map<string, { entries: AgentMemoryEntry[]; totalBytes: number }>();

  constructor(config: AgentMemoryConfig = {}) {
    this.maxEntries = normalizeLimit(config.maxEntries, DEFAULT_MAX_ENTRIES);
    this.maxBytes = normalizeLimit(config.maxBytes, DEFAULT_MAX_BYTES);
  }

  public addEntry(runId: string, data: unknown): AgentMemoryEntry {
    const safeData = sanitizeEntry(data);
    const bytes = getEntryBytes(safeData);
    const entry: AgentMemoryEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      data: safeData,
      bytes,
    };

    const run = this.ensureRun(runId);
    run.entries.push(entry);
    run.totalBytes += bytes;

    this.trimRun(run);
    return entry;
  }

  public listEntries(runId: string): AgentMemoryEntry[] {
    const run = this.runs.get(runId);
    return run ? [...run.entries] : [];
  }

  public getSnapshot(runId: string): AgentMemorySnapshot {
    const run = this.runs.get(runId);
    if (!run) {
      return {
        runId,
        entries: [],
        totalBytes: 0,
        maxEntries: this.maxEntries,
        maxBytes: this.maxBytes,
      };
    }

    return {
      runId,
      entries: [...run.entries],
      totalBytes: run.totalBytes,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
    };
  }

  public serializeRun(runId: string): string {
    const snapshot = this.getSnapshot(runId);
    try {
      return JSON.stringify(snapshot);
    } catch {
      return JSON.stringify({ runId, entries: [], totalBytes: 0 });
    }
  }

  public clearRun(runId: string): void {
    this.runs.delete(runId);
  }

  public clearAll(): void {
    this.runs.clear();
  }

  private ensureRun(runId: string): { entries: AgentMemoryEntry[]; totalBytes: number } {
    const existing = this.runs.get(runId);
    if (existing) {
      return existing;
    }

    const run = { entries: [], totalBytes: 0 };
    this.runs.set(runId, run);
    return run;
  }

  private trimRun(run: { entries: AgentMemoryEntry[]; totalBytes: number }): void {
    if (run.entries.length === 0) {
      run.totalBytes = 0;
      return;
    }

    while (run.entries.length > this.maxEntries) {
      const removed = run.entries.shift();
      if (removed) {
        run.totalBytes -= removed.bytes;
      }
    }

    while (run.totalBytes > this.maxBytes && run.entries.length > 1) {
      const removed = run.entries.shift();
      if (removed) {
        run.totalBytes -= removed.bytes;
      }
    }

    if (run.totalBytes > this.maxBytes && run.entries.length === 1) {
      const remaining = run.entries[0];
      run.entries = [remaining];
      run.totalBytes = remaining.bytes;
    }
  }
}

export const DEFAULT_MEMORY_LIMITS = {
  maxEntries: DEFAULT_MAX_ENTRIES,
  maxBytes: DEFAULT_MAX_BYTES,
};
