import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SddWatcher, setSddWatchForTesting } from './SddWatcher';

const recordFileChange = vi.fn();
let tempWorkspace = '';

vi.mock('./SddTraceService', () => ({
  SddTraceService: {
    getInstance: () => ({
      recordFileChange,
    }),
  },
}));

vi.mock('./WorkspaceService', () => {
  let workspacePath: string | null = null;
  return {
    WorkspaceService: {
      getInstance: () => ({
        getWorkspace: () =>
          workspacePath ? { path: workspacePath, name: 'workspace' } : null,
      }),
    },
    __setWorkspacePath: (value: string | null) => {
      workspacePath = value;
    },
  };
});

type WatchRegistration = {
  root: string;
  callback: (eventType: string, filename: string | Buffer | undefined) => void;
  close: ReturnType<typeof vi.fn>;
};

describe('SddWatcher', () => {
  let watchers: WatchRegistration[] = [];
  let setWorkspacePath: ((value: string | null) => void) | null = null;

  beforeEach(async () => {
    const workspaceModule = await import('./WorkspaceService');
    setWorkspacePath = (workspaceModule as any).__setWorkspacePath;
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-watch-'));
    setWorkspacePath?.(tempWorkspace);

    watchers = [];
    const watchMock = vi.fn(
      (
        root: fs.PathLike,
        _options: fs.WatchOptions,
        listener: (eventType: string, filename: string | Buffer | undefined) => void
      ) => {
        const registration: WatchRegistration = {
          root: root.toString(),
          callback: listener,
          close: vi.fn(),
        };
        watchers.push(registration);
        return { close: registration.close } as fs.FSWatcher;
      }
    );
    setSddWatchForTesting(watchMock as unknown as typeof fs.watch);

    recordFileChange.mockClear();
    // @ts-expect-error reset singleton for tests
    SddWatcher.instance = null;
  });

  afterEach(() => {
    setSddWatchForTesting();
    setWorkspacePath?.(null);
    if (tempWorkspace) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
    tempWorkspace = '';
    vi.restoreAllMocks();
  });

  it('debounces change events and records a single modification', async () => {
    vi.useFakeTimers();
    const watcher = SddWatcher.getInstance();
    watcher.start({ debounceMs: 50 });

    expect(watchers).toHaveLength(1);

    const filePath = path.join(tempWorkspace, 'src', 'file.txt');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'content', 'utf-8');

    watchers[0]?.callback('change', path.relative(tempWorkspace, filePath));
    watchers[0]?.callback('change', path.relative(tempWorkspace, filePath));

    expect(recordFileChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60);

    expect(recordFileChange).toHaveBeenCalledTimes(1);
    expect(recordFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: filePath, op: 'modified', actor: 'human' })
    );

    vi.useRealTimers();
  });

  it('records delete operations for rename events when file is missing', async () => {
    vi.useFakeTimers();
    const watcher = SddWatcher.getInstance();
    watcher.start({ debounceMs: 10 });

    const filePath = path.join(tempWorkspace, 'deleted.txt');
    fs.writeFileSync(filePath, 'gone', 'utf-8');
    fs.unlinkSync(filePath);

    watchers[0]?.callback('rename', path.relative(tempWorkspace, filePath));
    await vi.advanceTimersByTimeAsync(20);

    expect(recordFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: filePath, op: 'deleted', actor: 'human' })
    );

    vi.useRealTimers();
  });

  it('ignores changes inside the SDD storage directory', async () => {
    vi.useFakeTimers();
    const watcher = SddWatcher.getInstance();
    watcher.start({ debounceMs: 10 });

    const sddPath = path.join(tempWorkspace, '.ai-shell', 'sdd', 'trace.jsonl');
    fs.mkdirSync(path.dirname(sddPath), { recursive: true });
    fs.writeFileSync(sddPath, 'event', 'utf-8');

    watchers[0]?.callback('change', path.relative(tempWorkspace, sddPath));
    await vi.advanceTimersByTimeAsync(20);

    expect(recordFileChange).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('stops watching when disabled', () => {
    const watcher = SddWatcher.getInstance();
    watcher.start();
    watcher.stop();

    watchers.forEach((registration) => {
      expect(registration.close).toHaveBeenCalledTimes(1);
    });
    expect(watcher.isRunning()).toBe(false);
  });
});
