import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const mockUserDataPath = 'C:\\mock\\userdata';
const mockStorePath = path.join(mockUserDataPath, 'agent-runs.json');

let savedContent = '';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn((file: string, data: string) => {
    if (file === 'C:\\mock\\userdata\\agent-runs.json') {
      savedContent = data;
    }
  }),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { AgentRunStore } from './AgentRunStore';

describe('AgentRunStore', () => {
  let store: AgentRunStore;

  beforeEach(() => {
    vi.clearAllMocks();
    savedContent = '';
    // @ts-expect-error Reset singleton for tests
    AgentRunStore.instance = null;
    store = AgentRunStore.getInstance();
  });

  it('creates and lists runs', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const created = store.createRun('user');

    expect(created.status).toBe('queued');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockStorePath,
      expect.any(String),
      'utf-8'
    );

    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    const list = store.listRuns();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it('appends events and paginates', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const run = store.createRun('user');
    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    store.appendEvent({
      id: randomUUID(),
      runId: run.id,
      timestamp: new Date().toISOString(),
      type: 'status',
      status: 'running',
    });

    store.appendEvent({
      id: randomUUID(),
      runId: run.id,
      timestamp: new Date().toISOString(),
      type: 'log',
      level: 'info',
      message: 'step 1',
    });

    const first = store.listEvents({ runId: run.id, limit: 1 });
    expect(first.events).toHaveLength(1);
    expect(first.nextCursor).toBe('1');

    const second = store.listEvents({ runId: run.id, limit: 1, cursor: first.nextCursor });
    expect(second.events).toHaveLength(1);
    expect(second.nextCursor).toBeUndefined();
  });

  it('updates routing metadata for a run', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const run = store.createRun('user');
    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    const updated = store.updateRunRouting(run.id, {
      connectionId: '123e4567-e89b-12d3-a456-426614174000',
      providerId: 'ollama',
      modelRef: 'llama3',
    });

    expect(updated.routing?.providerId).toBe('ollama');
    expect(updated.routing?.connectionId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('caps events per run', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const run = store.createRun('user');
    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    const firstId = randomUUID();
    store.appendEvent({
      id: firstId,
      runId: run.id,
      timestamp: new Date().toISOString(),
      type: 'status',
      status: 'running',
    });

    for (let index = 0; index < 205; index += 1) {
      store.appendEvent({
        id: randomUUID(),
        runId: run.id,
        timestamp: new Date().toISOString(),
        type: 'log',
        level: 'info',
        message: `event-${index}`,
      });
    }

    const events = store.listEvents({ runId: run.id }).events;
    expect(events.length).toBe(200);
    expect(events[0].id).not.toBe(firstId);
  });

  it('redacts sensitive fields in tool calls', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const run = store.createRun('user');
    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    store.appendEvent({
      id: randomUUID(),
      runId: run.id,
      timestamp: new Date().toISOString(),
      type: 'tool-call',
      toolCall: {
        callId: randomUUID(),
        toolId: 'test-tool',
        requesterId: 'agent',
        runId: run.id,
        input: { apiKey: 'secret-123', normalField: 'visible' },
      },
    });

    const events = store.listEvents({ runId: run.id }).events;
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool-call');
    if (events[0].type === 'tool-call') {
      const input = events[0].toolCall.input as Record<string, unknown>;
      expect(input.apiKey).toBe('[REDACTED]');
      expect(input.normalField).toBe('visible');
    }
  });
});
