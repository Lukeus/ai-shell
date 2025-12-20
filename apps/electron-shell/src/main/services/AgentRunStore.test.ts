import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunStore } from './AgentRunStore';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const mockUserDataPath = 'C:\\mock\\userdata';
const mockStorePath = path.join(mockUserDataPath, 'agent-runs.json');

let savedContent = '';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn((file: string, data: string) => {
    if (file === mockStorePath) {
      savedContent = data;
    }
  }),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

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
});
