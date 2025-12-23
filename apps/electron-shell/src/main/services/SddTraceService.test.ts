import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SddTraceService } from './SddTraceService';

let tempWorkspace = '';
let setWorkspacePath: ((value: string | null) => void) | null = null;

vi.mock('./WorkspaceService', () => {
  let currentWorkspace: string | null = null;
  return {
    WorkspaceService: {
      getInstance: () => ({
        getWorkspace: () =>
          currentWorkspace ? { path: currentWorkspace, name: 'workspace' } : null,
      }),
    },
    __setWorkspacePath: (value: string | null) => {
      currentWorkspace = value;
    },
  };
});

const getLedgerPath = (workspaceRoot: string): string =>
  path.join(workspaceRoot, '.ai-shell', 'sdd', 'trace.jsonl');

const getIndexPath = (workspaceRoot: string): string =>
  path.join(workspaceRoot, '.ai-shell', 'sdd', 'index.json');

const readIndex = (workspaceRoot: string): any => {
  const raw = fs.readFileSync(getIndexPath(workspaceRoot), 'utf-8');
  return JSON.parse(raw);
};

describe('SddTraceService', () => {
  beforeEach(async () => {
    const workspaceModule = await import('./WorkspaceService');
    setWorkspacePath = (workspaceModule as any).__setWorkspacePath;

    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-trace-'));
    setWorkspacePath?.(tempWorkspace);

    // @ts-expect-error reset singleton for tests
    SddTraceService.instance = null;
  });

  afterEach(() => {
    setWorkspacePath?.(null);
    if (tempWorkspace) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
    tempWorkspace = '';
    vi.restoreAllMocks();
  });

  it('writes RUN_STARTED and RUN_STOPPED events and updates index', async () => {
    const service = SddTraceService.getInstance();
    await service.setEnabled(true);

    const run = await service.startRun({
      featureId: '140-sdd',
      taskId: 'task-1',
      inputs: [],
    });
    await service.stopRun();

    const ledgerLines = fs
      .readFileSync(getLedgerPath(tempWorkspace), 'utf-8')
      .trim()
      .split('\n');
    expect(ledgerLines).toHaveLength(2);
    expect(JSON.parse(ledgerLines[0] ?? '{}').type).toBe('RUN_STARTED');
    expect(JSON.parse(ledgerLines[1] ?? '{}').type).toBe('RUN_STOPPED');

    const index = readIndex(tempWorkspace);
    expect(index.runsById[run.runId].status).toBe('stopped');
  });

  it('tracks file changes when a run is active', async () => {
    const service = SddTraceService.getInstance();
    await service.setEnabled(true);

    const run = await service.startRun({
      featureId: '140-sdd',
      taskId: 'task-2',
      inputs: [],
    });

    const filePath = path.join(tempWorkspace, 'src', 'tracked.txt');
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, 'tracked', 'utf-8');

    await service.recordFileChange({
      path: filePath,
      op: 'modified',
      actor: 'human',
    });

    const index = readIndex(tempWorkspace);
    expect(index.fileToRuns[filePath]).toContain(run.runId);
    expect(index.taskToFiles['140-sdd/task-2']).toContain(filePath);
    expect(index.latestParitySnapshot.trackedFileChanges).toBe(1);
    expect(index.latestParitySnapshot.untrackedFileChanges).toBe(0);
  });

  it('records untracked changes when no run is active', async () => {
    const service = SddTraceService.getInstance();
    await service.setEnabled(true);

    const filePath = path.join(tempWorkspace, 'src', 'untracked.txt');
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, 'untracked', 'utf-8');

    await service.recordFileChange({
      path: filePath,
      op: 'modified',
      actor: 'human',
    });

    const index = readIndex(tempWorkspace);
    expect(index.latestParitySnapshot.untrackedFileChanges).toBe(1);
    expect(index.latestParitySnapshot.driftFiles).toContain(filePath);
  });

  it('computes tracked ratio from parity totals', async () => {
    const service = SddTraceService.getInstance();
    await service.setEnabled(true);

    const run = await service.startRun({
      featureId: '140-sdd',
      taskId: 'task-3',
      inputs: [],
    });

    const trackedFile = path.join(tempWorkspace, 'src', 'tracked-1.txt');
    await fs.promises.mkdir(path.dirname(trackedFile), { recursive: true });
    await fs.promises.writeFile(trackedFile, 'tracked', 'utf-8');
    await service.recordFileChange({
      path: trackedFile,
      op: 'modified',
      actor: 'human',
    });

    await service.stopRun();

    const untrackedFile = path.join(tempWorkspace, 'src', 'untracked-1.txt');
    await fs.promises.writeFile(untrackedFile, 'untracked', 'utf-8');
    await service.recordFileChange({
      path: untrackedFile,
      op: 'modified',
      actor: 'human',
    });

    const index = readIndex(tempWorkspace);
    expect(index.latestParitySnapshot.trackedFileChanges).toBe(1);
    expect(index.latestParitySnapshot.untrackedFileChanges).toBe(1);
    expect(index.latestParitySnapshot.trackedRatio).toBe(0.5);
    expect(index.runsById[run.runId].status).toBe('stopped');
  });

  it('rejects file changes outside workspace boundaries', async () => {
    const service = SddTraceService.getInstance();
    await service.setEnabled(true);

    await expect(
      service.recordFileChange({
        path: path.join(tempWorkspace, '..', 'outside.txt'),
        op: 'modified',
        actor: 'human',
      })
    ).rejects.toThrow();

    await expect(
      service.recordFileChange({
        path: '../outside.txt',
        op: 'modified',
        actor: 'human',
      })
    ).rejects.toThrow();
  });

  it('rebuilds index from ledger without losing run links', async () => {
    const service = SddTraceService.getInstance();
    await service.setEnabled(true);

    const run = await service.startRun({
      featureId: '140-sdd',
      taskId: 'task-4',
      inputs: [],
    });

    const trackedFile = path.join(tempWorkspace, 'src', 'rebuild.txt');
    await fs.promises.mkdir(path.dirname(trackedFile), { recursive: true });
    await fs.promises.writeFile(trackedFile, 'rebuild', 'utf-8');
    await service.recordFileChange({
      path: trackedFile,
      op: 'modified',
      actor: 'human',
    });
    await service.stopRun();

    const indexBefore = readIndex(tempWorkspace);
    const rebuilt = await service.rebuildIndexFromLedger();
    const indexAfter = readIndex(tempWorkspace);

    expect(rebuilt.runsById[run.runId]).toMatchObject({
      featureId: '140-sdd',
      taskId: 'task-4',
      status: 'stopped',
    });
    expect(indexAfter.fileToRuns[trackedFile]).toContain(run.runId);
    expect(indexAfter.taskToFiles['140-sdd/task-4']).toContain(trackedFile);

    // Parity counts should remain consistent after rebuild (ignore updatedAt).
    expect(indexAfter.latestParitySnapshot.trackedFileChanges).toBe(
      indexBefore.latestParitySnapshot.trackedFileChanges
    );
    expect(indexAfter.latestParitySnapshot.untrackedFileChanges).toBe(
      indexBefore.latestParitySnapshot.untrackedFileChanges
    );
  });
});
