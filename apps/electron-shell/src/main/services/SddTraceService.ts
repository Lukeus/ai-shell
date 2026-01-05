import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import ignore, { type Ignore } from 'ignore';
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
const LEDGER_ARCHIVE_PREFIX = 'trace-';
const LEDGER_EXTENSION = '.jsonl';
const INDEX_FILENAME = 'index.json';
const GITIGNORE_FILENAME = '.gitignore';
const DEFAULT_IGNORED_DIRS = new Set(['.ai-shell', '.git']);
// Ledger rotation policy: rotate trace.jsonl once it exceeds these limits.
// Override via SDD_TRACE_MAX_BYTES / SDD_TRACE_MAX_LINES (positive integers).
const DEFAULT_MAX_LEDGER_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_LEDGER_LINES = 50000;

const FILE_EVENT_TYPES = new Set([
  'FILE_MODIFIED',
  'FILE_ADDED',
  'FILE_DELETED',
  'FILE_RENAMED',
  'UNTRACKED_CHANGE_DETECTED',
]);

const parsePositiveInt = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const getLedgerRotationLimits = (): { maxBytes: number; maxLines: number } => {
  const maxBytes =
    parsePositiveInt(process.env.SDD_TRACE_MAX_BYTES) ?? DEFAULT_MAX_LEDGER_BYTES;
  const maxLines =
    parsePositiveInt(process.env.SDD_TRACE_MAX_LINES) ?? DEFAULT_MAX_LEDGER_LINES;
  return { maxBytes, maxLines };
};

const buildArchiveName = (timestamp: string): string => {
  const safe = timestamp.replace(/[:.]/g, '-');
  return `${LEDGER_ARCHIVE_PREFIX}${safe}${LEDGER_EXTENSION}`;
};

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
  private ignoreMatcher: Ignore | null = null;
  private ignoreMtimeMs: number | null = null;
  private statusListeners = new Set<(status: SddStatus) => void>();
  private commitOverride: { reason: string; createdAt: string } | null = null;
  private readonly ledgerRotation = getLedgerRotationLimits();

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
    if (!enabled) {
      this.commitOverride = null;
    }
    await this.emitStatusChange();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async getStatus(): Promise<SddStatus> {
    const index = await this.ensureIndexLoaded();
    return {
      activeRun: this.activeRun,
      parity: this.getParitySnapshot(index),
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
    this.selectedTask = { featureId: run.featureId, taskId: run.taskId };
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
    if (!this.isTrackingInitialized()) {
      return;
    }

    const paths = await this.ensureStorage();
    const validatedPath = await resolvePathWithinWorkspace(
      params.path,
      paths.workspaceRoot,
      { requireExisting: params.op !== 'deleted' }
    );
    if (await this.isIgnoredPath(validatedPath, paths.workspaceRoot)) {
      return;
    }

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
    void this.emitStatusChange();
  }

  public async overrideUntracked(reason: string, actor = 'human'): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const sanitizedReason = this.sanitizeReason(reason);
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
    this.commitOverride = { reason: sanitizedReason, createdAt: now };
    await this.emitStatusChange();
  }

  public consumeCommitOverride(): { reason: string; createdAt: string } | null {
    const override = this.commitOverride;
    this.commitOverride = null;
    return override;
  }

  public async recordCommitEvent(params: {
    type: 'COMMIT_BLOCKED' | 'COMMIT_SUCCEEDED';
    reason?: string;
    driftFiles?: string[];
    actor?: string;
  }): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const paths = await this.ensureStorage();
    const now = new Date().toISOString();
    const meta: Record<string, string | number | boolean | null> = {};
    if (params.reason) {
      const sanitized = this.sanitizeReason(params.reason);
      if (sanitized) {
        meta.reason = sanitized;
      }
    }
    if (params.driftFiles) {
      meta.driftFilesCount = params.driftFiles.length;
    }

    const event: SddEvent = {
      v: SDD_SCHEMA_VERSION,
      ts: now,
      type: params.type,
      actor: params.actor ?? 'human',
      run: this.activeRun
        ? {
            runId: this.activeRun.runId,
            featureId: this.activeRun.featureId,
            taskId: this.activeRun.taskId,
          }
        : undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
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
    return this.getParitySnapshot(index);
  }

  public async rebuildIndexFromLedger(): Promise<SddIndex> {
    const paths = await this.ensureStorage();
    await this.loadIgnoreMatcher(paths.workspaceRoot);
    const index = this.createEmptyIndex();
    const ledgerFiles = await this.listLedgerFiles(paths);
    for (const ledgerPath of ledgerFiles) {
      try {
        const contents = await fs.promises.readFile(ledgerPath, 'utf-8');
        const lines = contents.split('\n').filter((line) => line.trim().length > 0);

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as SddEvent;
            this.applyEventToIndex(index, event, paths.workspaceRoot);
          } catch {
            // Skip malformed lines.
          }
        }
      } catch {
        // Skip unreadable ledger segments.
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
    this.applyEventToIndex(index, event, paths.workspaceRoot);
    await this.rotateLedgerIfNeeded(paths);
    await fs.promises.appendFile(paths.ledgerPath, `${JSON.stringify(event)}\n`, 'utf-8');
    await this.writeIndex(paths.indexPath, index);
  }

  private applyEventToIndex(
    index: SddIndex,
    event: SddEvent,
    workspaceRoot: string
  ): void {
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
      this.applyFileEvent(index, event, updatedAt, workspaceRoot);
    }

    index.latestParitySnapshot.updatedAt = updatedAt;
  }

  private applyFileEvent(
    index: SddIndex,
    event: SddEvent,
    updatedAt: string,
    workspaceRoot: string
  ): void {
    const files = (event.files ?? []).filter(
      (file) => !this.isIgnoredPathSync(file.path, workspaceRoot)
    );
    if (files.length === 0) {
      index.latestParitySnapshot.updatedAt = updatedAt;
      return;
    }
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
      const hash = await this.computeFileHash(resolved);
      validated.push({ ...docRef, path: resolved, hash });
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
      parity: this.getParitySnapshot(index),
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

  private sanitizeReason(reason: string): string {
    return reason.trim().slice(0, 500);
  }

  private getParitySnapshot(index: SddIndex): SddParity {
    if (!this.isTrackingInitialized()) {
      return {
        trackedFileChanges: 0,
        untrackedFileChanges: 0,
        trackedRatio: 1,
        driftFiles: [],
        staleDocs: [],
      };
    }
    return index.latestParitySnapshot;
  }

  private isTrackingInitialized(): boolean {
    return Boolean(this.activeRun || this.selectedTask);
  }

  private async isIgnoredPath(filePath: string, workspaceRoot: string): Promise<boolean> {
    await this.loadIgnoreMatcher(workspaceRoot);
    return this.isIgnoredPathSync(filePath, workspaceRoot);
  }

  private isIgnoredPathSync(filePath: string, workspaceRoot: string): boolean {
    const relative = path.relative(workspaceRoot, filePath);
    if (!relative || relative.startsWith('..')) {
      return true;
    }
    if (this.isAlwaysIgnored(relative)) {
      return true;
    }
    if (!this.ignoreMatcher) {
      return false;
    }
    const normalized = relative.replace(/\\/g, '/');
    return this.ignoreMatcher.ignores(normalized);
  }

  private isAlwaysIgnored(relativePath: string): boolean {
    const segments = relativePath.split(/[\\/]/);
    return segments.some((segment) => DEFAULT_IGNORED_DIRS.has(segment));
  }

  private async loadIgnoreMatcher(workspaceRoot: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, GITIGNORE_FILENAME);
    let raw: string | null = null;
    let mtimeMs: number | null = null;

    try {
      const stat = await fs.promises.stat(gitignorePath);
      mtimeMs = stat.mtimeMs;
      raw = await fs.promises.readFile(gitignorePath, 'utf-8');
    } catch {
      // No gitignore found; fall back to default ignores only.
    }

    if (this.ignoreMatcher && this.ignoreMtimeMs === mtimeMs) {
      return;
    }

    const matcher = ignore();
    matcher.add(Array.from(DEFAULT_IGNORED_DIRS, (dir) => `${dir}/`));
    if (raw) {
      matcher.add(raw);
    }
    this.ignoreMatcher = matcher;
    this.ignoreMtimeMs = mtimeMs;
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

  private async rotateLedgerIfNeeded(paths: StoragePaths): Promise<void> {
    const { maxBytes, maxLines } = this.ledgerRotation;
    if (maxBytes <= 0 && maxLines <= 0) {
      return;
    }

    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(paths.ledgerPath);
    } catch {
      return;
    }

    if (stats.size === 0) {
      return;
    }

    if (maxBytes > 0 && stats.size >= maxBytes) {
      await this.rotateLedger(paths);
      return;
    }

    if (maxLines > 0) {
      const lineCount = await this.countLedgerLines(paths.ledgerPath);
      if (lineCount >= maxLines) {
        await this.rotateLedger(paths);
      }
    }
  }

  private async rotateLedger(paths: StoragePaths): Promise<void> {
    const timestamp = new Date().toISOString();
    const archiveName = buildArchiveName(timestamp);
    const archivePath = path.join(paths.sddRoot, archiveName);

    try {
      await fs.promises.rename(paths.ledgerPath, archivePath);
    } catch {
      return;
    }

    await fs.promises.writeFile(paths.ledgerPath, '', 'utf-8');
  }

  private async countLedgerLines(ledgerPath: string): Promise<number> {
    try {
      const contents = await fs.promises.readFile(ledgerPath, 'utf-8');
      if (!contents) {
        return 0;
      }
      return contents.split('\n').filter((line) => line.trim().length > 0).length;
    } catch {
      return 0;
    }
  }

  private async listLedgerFiles(paths: StoragePaths): Promise<string[]> {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(paths.sddRoot);
    } catch {
      return [paths.ledgerPath];
    }

    const ledgerFiles = entries.filter((entry) => {
      if (entry === LEDGER_FILENAME) {
        return true;
      }
      return entry.startsWith(LEDGER_ARCHIVE_PREFIX) && entry.endsWith(LEDGER_EXTENSION);
    });

    ledgerFiles.sort();

    return ledgerFiles.map((entry) => path.join(paths.sddRoot, entry));
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
