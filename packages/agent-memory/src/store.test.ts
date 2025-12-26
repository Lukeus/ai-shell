import { describe, expect, it } from 'vitest';
import { AgentMemoryStore, DEFAULT_MEMORY_LIMITS } from './store';

describe('AgentMemoryStore', () => {
  it('stores entries per run', () => {
    const store = new AgentMemoryStore();
    const entry = store.addEntry('run-1', { message: 'hello' });

    const entries = store.listEntries('run-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].data).toEqual({ message: 'hello' });
    expect(entries[0].id).toBe(entry.id);
  });

  it('trims entries by maxEntries', () => {
    const store = new AgentMemoryStore({ maxEntries: 2, maxBytes: DEFAULT_MEMORY_LIMITS.maxBytes });
    store.addEntry('run-1', { value: 'first' });
    store.addEntry('run-1', { value: 'second' });
    store.addEntry('run-1', { value: 'third' });

    const entries = store.listEntries('run-1');
    expect(entries).toHaveLength(2);
    expect(entries[0].data).toEqual({ value: 'second' });
    expect(entries[1].data).toEqual({ value: 'third' });
  });

  it('trims entries by maxBytes', () => {
    const store = new AgentMemoryStore({ maxEntries: 10, maxBytes: 60 });
    store.addEntry('run-1', { value: 'a'.repeat(40) });
    store.addEntry('run-1', { value: 'b'.repeat(40) });

    const snapshot = store.getSnapshot('run-1');
    expect(snapshot.totalBytes).toBeLessThanOrEqual(60);
    expect(snapshot.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('sanitizes non-serializable values', () => {
    const store = new AgentMemoryStore();
    const payload: Record<string, unknown> = { value: 123 };
    payload.self = payload;
    payload.fn = () => undefined;

    store.addEntry('run-1', payload);

    const entry = store.listEntries('run-1')[0];
    expect(entry.data).toMatchObject({
      value: 123,
      self: '[circular]',
      fn: '[function]',
    });

    expect(() => store.serializeRun('run-1')).not.toThrow();
  });
});
