import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import type {
  SddDocRef,
  SddEvent,
  SddParity,
  SddRun,
  SddStatus,
  SddStartRunRequest,
  SddFileTraceResponse,
  SddTaskTraceResponse,
} from 'packages-api-contracts';
import { WorkspaceService } from './WorkspaceService';
import { resolvePathWithinWorkspace } from './workspace-paths';

type SddFileOperation = 'modified' | 'added' | 'deleted' | 'renamed';

type SddIndex = {
  schemaVersion: number;
  runsById: Record<string, SddRun>;
  fileToRuns: Record<string, string[]>;
  taskToFiles: Record<string, string[]>;
  latestParitySnapshot: SddParity & { updatedAt: string };
};

type StoragePaths = {
  workspaceRoot: string;
  sddRoot: string;
  ledgerPath: string;
  indexPath: string;
};

const SDD_SCHEMA_VERSION = 1;
const SDD_DIRNAME = '.ai-shell';
const SDD_SUBDIR = 'sdd';
const LEDGER_FILENAME = 'trace.jsonl';
const INDEX_FILENAME = 'index.json';

const FILE_EVENT_TYPES = new Set([
  'FILE_MODIFIED',
  'FILE_ADDED',
  'FILE_DELETED',
  'FILE_RENAMED',
  'UNTRACKED_CHANGE_DETECTED',
]);

/**
 * SddTraceService - main-process ledger + index for SDD provenance.
 */
export class SddTraceService {
  private static instance: SddTraceService | null = null;
  private readonly workspaceService: WorkspaceService;
  private enabled = false;
  private activeRun: SddRun | null = null;
  private activeDocRefs: SddDocRef[] = [];
  private index: SddIndex | null = null;
  private selectedTask: { featureId: string; taskId: string } | null = null;
  private statusListeners = new Set<(status: SddStatus) => void>();

  private constructor() {
    this.workspaceService = WorkspaceService.getInstance();
  }

  public static getInstance(): SddTraceService {
    if (!SddTraceService.instance) {
      SddTraceService.instance = new SddTraceService();
    }
    return SddTraceService.instance;
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    if (this.enabled === enabled) {
      return;
    }
    if (!enabled && this.activeRun) {
      await this.abortActiveRun('system');
    }
    this.enabled = enabled;
    await this.emitStatusChange();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async getStatus(): Promise<SddStatus> {
    const index = await this.ensureIndexLoaded();
    return {
      activeRun: this.activeRun,
      parity: index.latestParitySnapshot,
    };
  }

  public async startRun(request: SddStartRunRequest, actor = 'human'): Promise<SddRun> {
    if (!this.enabled) {
      throw new Error('SDD is disabled.');
    }
    if (this.activeRun) {
      throw new Error('An SDD run is already active.');
    }

    const paths = await this.ensureStorage();
    const docRefs = await this.validateDocRefs(request.inputs ?? [], paths.workspaceRoot);
    const now = new Date().toISOString();
    const run: SddRun = {
      runId: randomUUID(),
      featureId: request.featureId,
      taskId: request.taskId,
      startedAt: now,
      stoppedAt: null,
      status: 'running',
    };

    const event: SddEvent = {
      v: SDD_SCHEMA_VERSION,
      ts: now,
      type: 'RUN_STARTED',
      actor,
      run: {
        runId: run.runId,
        featureId: run.featureId,
        taskId: run.taskId,
      },
      docRefs,
    };

    await this.recordEvent(event, paths);
    this.activeRun = run;
    this.activeDocRefs = docRefs;
    await this.emitStatusChange();
    return run;
  }

  public async stopRun(actor = 'human'): Promise<void> {
    if (!this.activeRun) {
      return;
    }
    const paths = await this.ensureStorage();
    const now = new Date().toISOString();
    const event: SddEvent = {
      v: SDD_SCHEMA_VERSION,
      ts: now,
      type: 'RUN_STOPPED',
      actor,
      run: {
        runId: this.activeRun.runId,
        featureId: this.activeRun.featureId,
        taskId: this.activeRun.taskId,
      },
    };
    await this.recordEvent(event, paths);
    this.activeRun = null;
    this.activeDocRefs = [];
    await this.emitStatusChange();
  }

  public async abortActiveRun(actor = 'system'): Promise<void> {
    if (!this.activeRun) {
      return;
    }
    const paths = await this.ensureStorage();
    const now = new Date().toISOString();
    const event: SddEvent = {
      v: SDD_SCHEMA_VERSION,
      ts: now,
      type: 'RUN_ABORTED',
      actor,
      run: {
        runId: this.activeRun.runId,
        featureId: this.activeRun.featureId,
        taskId: this.activeRun.taskId,
      },
    };
    await this.recordEvent(event, paths);
    this.activeRun = null;
    this.activeDocRefs = [];
    await this.emitStatusChange();
  }

  public async recordFileChange(params: {
    path: string;
    op: SddFileOperation;
    actor: string;
    hashBefore?: string;
    hashAfter?: string;
  }): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const paths = await this.ensureStorage();
    const validatedPath = await resolvePathWithinWorkspace(
      params.path,
      paths.workspaceRoot,
      { requireExisting: params.op !== 'deleted' }
    );

    const hashAfter =
      params.op === 'deleted'
        ? undefined
        : params.hashAfter ?? (await this.computeFileHash(validatedPath));

    const eventType = this.mapOpToEventType(params.op);
    const now = new Date().toISOString();
    const event: SddEvent = {
      v: SDD_SCHEMA_VERSION,
      ts: now,
      type: this.activeRun ? eventType : 'UNTRACKED_CHANGE_DETECTED',
      actor: params.actor,
      run: this.activeRun
        ? {
            runId: this.activeRun.runId,
            featureId: this.activeRun.featureId,
            taskId: this.activeRun.taskId,
          }
        : undefined,
      files: [
        {
          path: validatedPath,
          op: params.op,
          hashBefore: params.hashBefore,
          hashAfter,
        },
      ],
    };

    await this.recordEvent(event, paths);
    await this.emitStatusChange();
  }

  public setActiveTask(featureId: string, taskId: string): void {
    this.selectedTask = { featureId, taskId };
  }

  public async overrideUntracked(reason: string, actor = 'human'): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const sanitizedReason = reason.trim().slice(0, 500);
    if (!sanitizedReason) {
      throw new Error('Override reason is required.');
    }

    const paths = await this.ensureStorage();
    const now = new Date().toISOString();
    const event: SddEvent = {
      v: SDD_SCHEMA_VERSION,
      ts: now,
      type: 'COMMIT_OVERRIDDEN',
      actor,
      run: this.activeRun
        ? {
            runId: this.activeRun.runId,
            featureId: this.activeRun.featureId,
            taskId: this.activeRun.taskId,
          }
        : undefined,
      meta: { reason: sanitizedReason },
    };

    await this.recordEvent(event, paths);
    await this.emitStatusChange();
  }

  public async getFileTrace(filePath: string): Promise<SddFileTraceResponse> {
    const paths = await this.ensureStorage();
    const validatedPath = await resolvePathWithinWorkspace(filePath, paths.workspaceRoot);
    const index = await this.ensureIndexLoaded();
    const runIds = index.fileToRuns[validatedPath] ?? [];
    const runs = runIds.map((runId) => index.runsById[runId]).filter(Boolean);
    return { path: validatedPath, runs };
  }

  public async getTaskTrace(
    featureId: string,
    taskId: string
  ): Promise<SddTaskTraceResponse> {
    const index = await this.ensureIndexLoaded();
    const key = this.getTaskKey(featureId, taskId);
    const files = index.taskToFiles[key] ?? [];
    const runs = Object.values(index.runsById).filter(
      (run) => run.featureId === featureId && run.taskId === taskId
    );
    return { files, runs };
  }

  public async getParity(): Promise<SddParity> {
    const index = await this.ensureIndexLoaded();
    return index.latestParitySnapshot;
  }

  public async rebuildIndexFromLedger(): Promise<SddIndex> {
    const paths = await this.ensureStorage();
    const contents = await fs.promises.readFile(paths.ledgerPath, 'utf-8');
    const index = this.createEmptyIndex();
    const lines = contents.split('\n').filter((line) => line.trim().length > 0);

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as SddEvent;
        this.applyEventToIndex(index, event);
      } catch {
        // Skip malformed lines
      }
    }

    this.index = index;
    await this.writeIndex(paths.indexPath, index);
    await this.emitStatusChange(index);
    return index;
  }

  public onStatusChange(listener: (status: SddStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private async recordEvent(event: SddEvent, paths: StoragePaths): Promise<void> {
    const index = await this.ensureIndexLoaded();
    this.applyEventToIndex(index, event);
    await fs.promises.appendFile(paths.ledgerPath, `${JSON.stringify(event)}\n`, 'utf-8');
    await this.writeIndex(paths.indexPath, index);
  }

  private applyEventToIndex(index: SddIndex, event: SddEvent): void {
    const updatedAt = event.ts;
    if (event.type === 'RUN_STARTED' && event.run) {
      index.runsById[event.run.runId] = {
        runId: event.run.runId,
        featureId: event.run.featureId,
        taskId: event.run.taskId,
        startedAt: event.ts,
        stoppedAt: null,
        status: 'running',
      };
    }

    if ((event.type === 'RUN_STOPPED' || event.type === 'RUN_ABORTED') && event.run) {
      const existing = index.runsById[event.run.runId];
      index.runsById[event.run.runId] = {
        runId: event.run.runId,
        featureId: event.run.featureId,
        taskId: event.run.taskId,
        startedAt: existing?.startedAt ?? event.ts,
        stoppedAt: event.ts,
        status: event.type === 'RUN_ABORTED' ? 'aborted' : 'stopped',
      };
    }

    if (FILE_EVENT_TYPES.has(event.type)) {
      this.applyFileEvent(index, event, updatedAt);
    }

    index.latestParitySnapshot.updatedAt = updatedAt;
  }

  private applyFileEvent(index: SddIndex, event: SddEvent, updatedAt: string): void {
    const files = event.files ?? [];
    const driftFiles = new Set(index.latestParitySnapshot.driftFiles);
    let trackedChanges = index.latestParitySnapshot.trackedFileChanges;
    let untrackedChanges = index.latestParitySnapshot.untrackedFileChanges;

    for (const file of files) {
      if (event.run) {
        trackedChanges += 1;
        this.linkFileToRun(index, file.path, event.run.runId);
        this.linkFileToTask(
          index,
          file.path,
          event.run.featureId,
          event.run.taskId
        );
      } else {
        untrackedChanges += 1;
        driftFiles.add(file.path);
      }
    }

    index.latestParitySnapshot.trackedFileChanges = trackedChanges;
    index.latestParitySnapshot.untrackedFileChanges = untrackedChanges;
    index.latestParitySnapshot.trackedRatio = this.computeTrackedRatio(
      trackedChanges,
      untrackedChanges
    );
    index.latestParitySnapshot.driftFiles = Array.from(driftFiles);
    index.latestParitySnapshot.updatedAt = updatedAt;
  }

  private linkFileToRun(index: SddIndex, filePath: string, runId: string): void {
    const list = index.fileToRuns[filePath] ?? [];
    if (!list.includes(runId)) {
      list.unshift(runId);
      index.fileToRuns[filePath] = list;
    }
  }

  private linkFileToTask(
    index: SddIndex,
    filePath: string,
    featureId: string,
    taskId: string
  ): void {
    const key = this.getTaskKey(featureId, taskId);
    const list = index.taskToFiles[key] ?? [];
    if (!list.includes(filePath)) {
      list.push(filePath);
      index.taskToFiles[key] = list;
    }
  }

  private getTaskKey(featureId: string, taskId: string): string {
    return `${featureId}/${taskId}`;
  }

  private computeTrackedRatio(tracked: number, untracked: number): number {
    const total = tracked + untracked;
    if (total === 0) {
      return 1;
    }
    return tracked / total;
  }

  private mapOpToEventType(op: SddFileOperation): SddEvent['type'] {
    switch (op) {
      case 'added':
        return 'FILE_ADDED';
      case 'deleted':
        return 'FILE_DELETED';
      case 'renamed':
        return 'FILE_RENAMED';
      case 'modified':
      default:
        return 'FILE_MODIFIED';
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  private async validateDocRefs(
    docRefs: SddDocRef[],
    workspaceRoot: string
  ): Promise<SddDocRef[]> {
    const validated: SddDocRef[] = [];
    for (const docRef of docRefs) {
      const resolved = await resolvePathWithinWorkspace(docRef.path, workspaceRoot);
      validated.push({ ...docRef, path: resolved });
    }
    return validated;
  }

  private async ensureIndexLoaded(): Promise<SddIndex> {
    if (this.index) {
      return this.index;
    }
    const paths = await this.ensureStorage();
    this.index = await this.loadIndex(paths.indexPath);
    return this.index;
  }

  private async emitStatusChange(indexOverride?: SddIndex): Promise<void> {
    let index = indexOverride ?? this.index;
    if (!index) {
      try {
        index = await this.ensureIndexLoaded();
      } catch {
        return;
      }
    }

    const status: SddStatus = {
      activeRun: this.activeRun,
      parity: index.latestParitySnapshot,
    };

    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore listener errors to avoid breaking trace flow.
      }
    }
  }

  private createEmptyIndex(): SddIndex {
    return {
      schemaVersion: SDD_SCHEMA_VERSION,
      runsById: {},
      fileToRuns: {},
      taskToFiles: {},
      latestParitySnapshot: {
        trackedFileChanges: 0,
        untrackedFileChanges: 0,
        trackedRatio: 1,
        driftFiles: [],
        staleDocs: [],
        updatedAt: new Date().toISOString(),
      },
    };
  }

  private async loadIndex(indexPath: string): Promise<SddIndex> {
    try {
      const raw = await fs.promises.readFile(indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as SddIndex;
      return {
        schemaVersion: parsed.schemaVersion ?? SDD_SCHEMA_VERSION,
        runsById: parsed.runsById ?? {},
        fileToRuns: parsed.fileToRuns ?? {},
        taskToFiles: parsed.taskToFiles ?? {},
        latestParitySnapshot: {
          trackedFileChanges: parsed.latestParitySnapshot?.trackedFileChanges ?? 0,
          untrackedFileChanges: parsed.latestParitySnapshot?.untrackedFileChanges ?? 0,
          trackedRatio:
            parsed.latestParitySnapshot?.trackedRatio ??
            this.computeTrackedRatio(0, 0),
          driftFiles: parsed.latestParitySnapshot?.driftFiles ?? [],
          staleDocs: parsed.latestParitySnapshot?.staleDocs ?? [],
          updatedAt:
            parsed.latestParitySnapshot?.updatedAt ?? new Date().toISOString(),
        },
      };
    } catch {
      return this.createEmptyIndex();
    }
  }

  private async writeIndex(indexPath: string, index: SddIndex): Promise<void> {
    await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  private async ensureStorage(): Promise<StoragePaths> {
    const workspaceRoot = this.getWorkspaceRoot();
    const sddRoot = path.join(workspaceRoot, SDD_DIRNAME, SDD_SUBDIR);
    const ledgerPath = path.join(sddRoot, LEDGER_FILENAME);
    const indexPath = path.join(sddRoot, INDEX_FILENAME);

    await fs.promises.mkdir(sddRoot, { recursive: true });

    if (!fs.existsSync(ledgerPath)) {
      await fs.promises.writeFile(ledgerPath, '', 'utf-8');
    }

    if (!this.index) {
      this.index = await this.loadIndex(indexPath);
      await this.writeIndex(indexPath, this.index);
    }

    return { workspaceRoot, sddRoot, ledgerPath, indexPath };
  }

  private getWorkspaceRoot(): string {
    const workspace = this.workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder first.');
    }
    return workspace.path;
  }
}

export const sddTraceService = SddTraceService.getInstance();
