import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { GitService } from './GitService';
import * as path from 'path';
import { SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { settingsService } from './SettingsService';
import { sddTraceService } from './SddTraceService';

const workspaceRoot = 'C:\\mock\\workspace';

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

vi.mock('child_process', () => {
  const spawn = vi.fn();
  return {
    spawn,
    default: {
      spawn,
    },
  };
});

vi.mock('./SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
  },
}));

vi.mock('./SddTraceService', () => ({
  sddTraceService: {
    getParity: vi.fn(),
    recordCommitEvent: vi.fn(),
    isEnabled: vi.fn(),
    consumeCommitOverride: vi.fn(),
  },
}));

type MockChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill?: () => void;
};

const createChild = (): any => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.killed = false;
  return child;
};

const emitResult = (child: any, stdout: string, stderr = '', code = 0) => {
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
    vi.mocked(settingsService.getSettings).mockReturnValue(SETTINGS_DEFAULTS);
    vi.mocked(sddTraceService.isEnabled).mockReturnValue(false);
    vi.mocked(sddTraceService.consumeCommitOverride).mockReturnValue(null);
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
    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
      return child;
    });

    const service = GitService.getInstance();
    await service.stage({ all: false, paths: ['src/app.ts'] });

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['add', '--', path.join('src', 'app.ts')],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('stages all changes with -A', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
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
    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
      return child;
    });

    const service = GitService.getInstance();

    await expect(service.stage({ all: false, paths: [path.join('..', 'outside.txt')] })).rejects.toThrow(
      'Invalid path'
    );
  });

  it('commits with sanitized message', async () => {
    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
      return child;
    });

    const service = GitService.getInstance();
    const result = await service.commit({ message: '  hello   world  ' });

    expect(result).toEqual({ ok: true });
    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'hello world'],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('blocks commit when SDD enforcement detects untracked changes', async () => {
    vi.mocked(settingsService.getSettings).mockReturnValue({
      ...SETTINGS_DEFAULTS,
      sdd: {
        enabled: true,
        blockCommitOnUntrackedCodeChanges: true,
        customCommands: [],
      },
    });
    vi.mocked(sddTraceService.isEnabled).mockReturnValue(true);
    vi.mocked(sddTraceService.getParity).mockResolvedValue({
      trackedFileChanges: 1,
      untrackedFileChanges: 2,
      trackedRatio: 0.33,
      driftFiles: ['C:\\workspace\\drift.ts'],
      staleDocs: [],
    });

    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
      return child;
    });

    const service = GitService.getInstance();
    const result = await service.commit({ message: 'block me' });

    expect(result).toEqual({
      ok: false,
      blocked: true,
      reason: 'Untracked code changes detected.',
      untrackedFiles: ['C:\\workspace\\drift.ts'],
      driftFiles: ['C:\\workspace\\drift.ts'],
    });
    expect(vi.mocked(spawn)).not.toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'block me'],
      expect.anything()
    );
    expect(sddTraceService.recordCommitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COMMIT_BLOCKED' })
    );
  });

  it('commits when SDD enforcement is enabled but no drift exists', async () => {
    vi.mocked(settingsService.getSettings).mockReturnValue({
      ...SETTINGS_DEFAULTS,
      sdd: {
        enabled: true,
        blockCommitOnUntrackedCodeChanges: true,
        customCommands: [],
      },
    });
    vi.mocked(sddTraceService.isEnabled).mockReturnValue(true);
    vi.mocked(sddTraceService.getParity).mockResolvedValue({
      trackedFileChanges: 1,
      untrackedFileChanges: 0,
      trackedRatio: 1,
      driftFiles: [],
      staleDocs: [],
    });

    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
      return child;
    });

    const service = GitService.getInstance();
    const result = await service.commit({ message: 'clean commit' });

    expect(result).toEqual({ ok: true });
    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'clean commit'],
      expect.objectContaining({ cwd: workspaceRoot })
    );
    expect(sddTraceService.recordCommitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COMMIT_SUCCEEDED' })
    );
  });

  it('allows commit when an override is present', async () => {
    vi.mocked(settingsService.getSettings).mockReturnValue({
      ...SETTINGS_DEFAULTS,
      sdd: {
        enabled: true,
        blockCommitOnUntrackedCodeChanges: true,
        customCommands: [],
      },
    });
    vi.mocked(sddTraceService.isEnabled).mockReturnValue(true);
    vi.mocked(sddTraceService.consumeCommitOverride).mockReturnValue({
      reason: 'override',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    vi.mocked(spawn).mockImplementation((_cmd, args) => {
      const child = createChild();
      queueMicrotask(() => {
        if (args.includes('--is-inside-work-tree')) {
          emitResult(child, 'true');
          return;
        }
        emitResult(child, '');
      });
      return child;
    });

    const service = GitService.getInstance();
    const result = await service.commit({ message: 'override commit' });

    expect(result).toEqual({ ok: true });
    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'override commit'],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });
});
