import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SearchService, setSearchSpawnForTesting } from './SearchService';
import * as fs from 'fs';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      realpath: vi.fn(),
      stat: vi.fn(),
    },
  };
});

vi.mock('./WorkspaceService', () => ({
  WorkspaceService: {
    getInstance: () => ({
      getWorkspace: () => ({
        path: 'C:\\workspace',
        name: 'workspace',
      }),
    }),
  },
}));

describe('SearchService', () => {
  let spawnMock: ReturnType<typeof vi.fn>;
  let lastChild:
    | (EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      })
    | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    lastChild = null;
    spawnMock = vi.fn(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn(() => {
        child.emit('close', 0);
      });
      lastChild = child;
      return child;
    });
    setSearchSpawnForTesting(spawnMock as unknown as (command: string, args: string[], options: { cwd: string }) => any);
    // @ts-expect-error reset singleton for tests
    SearchService.instance = null;
    vi.mocked(fs.promises.realpath).mockImplementation(async (value: string) => value);
  });

  afterEach(() => {
    vi.useRealTimers();
    setSearchSpawnForTesting();
  });

  it('returns parsed results from ripgrep output', async () => {
    const service = SearchService.getInstance();
    const searchPromise = service.search({ query: 'App' });

    expect(spawnMock).toHaveBeenCalled();
    const payload = JSON.stringify({
      type: 'match',
      data: {
        path: { text: 'C:\\workspace\\src\\App.tsx' },
        line_number: 12,
        lines: { text: 'export function App() {\\n' },
        submatches: [
          {
            match: { text: 'App' },
            start: 16,
            end: 19,
          },
        ],
      },
    });
    lastChild?.stdout.emit('data', Buffer.from(`${payload}\n`));
    lastChild?.emit('close', 0);

    const result = await searchPromise;
    expect(result.truncated).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.filePath).toBe('C:\\workspace\\src\\App.tsx');
    expect(result.results[0]?.matches[0]).toMatchObject({
      line: 12,
      column: 17,
      matchText: 'App',
    });
  });

  it('rejects when ripgrep times out', async () => {
    vi.useFakeTimers();
    const service = SearchService.getInstance();
    const searchPromise = service.search({ query: 'App' });
    const rejection = expect(searchPromise).rejects.toThrow('ripgrep timed out');
    await vi.advanceTimersByTimeAsync(30000);
    await rejection;
  });
});
