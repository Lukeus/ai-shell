import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { GitService } from './GitService';
import * as path from 'path';

const workspaceRoot = vi.hoisted(() => path.resolve('workspace-root'));

vi.mock('./WorkspaceService', () => ({
  WorkspaceService: {
    getInstance: () => ({
      getWorkspace: () => ({
        path: workspaceRoot,
        name: 'workspace',
      }),
    }),
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

type MockChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill?: () => void;
};

const createChild = (): MockChild => {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
};

const emitResult = (child: MockChild, stdout: string, stderr = '', code = 0) => {
  if (stdout) {
    child.stdout.emit('data', Buffer.from(stdout));
  }
  if (stderr) {
    child.stderr.emit('data', Buffer.from(stderr));
  }
  child.emit('close', code);
};

describe('GitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error reset singleton for tests
    GitService.instance = null;
  });

  it('returns empty status when workspace is not a git repo', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'false');
        }
      });
      return child;
    });

    const service = GitService.getInstance();
    const status = await service.getStatus();

    expect(status).toEqual({ branch: null, staged: [], unstaged: [], untracked: [] });
  });

  it('parses staged/unstaged/untracked status entries', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        if (args.includes('--abbrev-ref')) {
          emitResult(child, 'main');
          return;
        }
        if (args.includes('--porcelain=v1')) {
          const output = [
            'M  staged.txt',
            ' M unstaged.txt',
            '?? untracked.txt',
            'R  old.txt',
            'new.txt',
            '',
          ].join('\0');
          emitResult(child, output);
        }
      });
      return child;
    });

    const service = GitService.getInstance();
    const status = await service.getStatus();

    expect(status.branch).toBe('main');
    expect(status.staged.map((item) => item.path)).toEqual(
      expect.arrayContaining(['staged.txt', 'new.txt'])
    );
    expect(status.unstaged.map((item) => item.path)).toEqual(['unstaged.txt']);
    expect(status.untracked.map((item) => item.path)).toEqual(['untracked.txt']);
  });

  it('stages specific paths relative to workspace', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, _args) => {
      const child = createChild();
      queueMicrotask(() => emitResult(child, ''));
      return child;
    });

    const service = GitService.getInstance();
    await service.stage({ paths: ['src/app.ts'] });

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['add', '--', path.join('src', 'app.ts')],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('stages all changes with -A', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, _args) => {
      const child = createChild();
      queueMicrotask(() => emitResult(child, ''));
      return child;
    });

    const service = GitService.getInstance();
    await service.stage({ all: true });

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('rejects staging paths outside workspace', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, _args) => {
      const child = createChild();
      queueMicrotask(() => emitResult(child, ''));
      return child;
    });

    const service = GitService.getInstance();

    await expect(service.stage({ paths: [path.join('..', 'outside.txt')] })).rejects.toThrow(
      'Invalid path'
    );
  });

  it('commits with sanitized message', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, _args) => {
      const child = createChild();
      queueMicrotask(() => emitResult(child, ''));
      return child;
    });

    const service = GitService.getInstance();
    await service.commit({ message: '  hello   world  ' });

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'hello world'],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });
});
