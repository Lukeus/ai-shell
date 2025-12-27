import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceService } from './WorkspaceService';
import { SddTraceService } from './SddTraceService';
import { resolvePathWithinWorkspace, WorkspacePathError, isPathWithinRoot } from './workspace-paths';

type SddWatcherOptions = {
  debounceMs?: number;
  trackRoots?: string[];
};

type PendingEvent = {
  eventType: 'rename' | 'change';
  root: string;
};

type WatchFn = typeof fs.watch;

let watchFn: WatchFn = fs.watch;

export const setSddWatchForTesting = (fn?: WatchFn): void => {
  watchFn = fn ?? fs.watch;
};

const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_IGNORED_DIRS = new Set(['.ai-shell', '.git']);

/**
 * SddWatcher - debounced workspace file watcher feeding SddTraceService.
 */
export class SddWatcher {
  private static instance: SddWatcher | null = null;
  private readonly workspaceService: WorkspaceService;
  private readonly traceService: SddTraceService;
  private readonly watchers = new Set<fs.FSWatcher>();
  private readonly pending = new Map<string, PendingEvent>();
  private debounceMs = DEFAULT_DEBOUNCE_MS;
  private flushTimer: NodeJS.Timeout | null = null;
  private running = false;

  private constructor() {
    this.workspaceService = WorkspaceService.getInstance();
    this.traceService = SddTraceService.getInstance();
  }

  public static getInstance(): SddWatcher {
    if (!SddWatcher.instance) {
      SddWatcher.instance = new SddWatcher();
    }
    return SddWatcher.instance;
  }

  public start(options: SddWatcherOptions = {}): void {
    if (this.running) {
      return;
    }
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const workspaceRoot = this.getWorkspaceRoot();
    const roots = this.resolveTrackRoots(workspaceRoot, options.trackRoots);

    roots.forEach((root) => {
      const watcher = watchFn(
        root,
        { recursive: true, encoding: 'utf8' },
        (eventType, filename) => {
          this.queueEvent(root, eventType, filename ?? undefined);
        }
      );
      this.watchers.add(watcher);
    });

    this.running = true;
  }

  public stop(): void {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers.clear();
    this.pending.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.running = false;
  }

  public setEnabled(enabled: boolean, options: SddWatcherOptions = {}): void {
    if (enabled) {
      this.start(options);
    } else {
      this.stop();
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  private queueEvent(
    root: string,
    eventType: string,
    filename: string | Buffer | undefined
  ): void {
    if (!filename) {
      return;
    }

    const name = Buffer.isBuffer(filename) ? filename.toString('utf8') : filename;
    if (!name) {
      return;
    }

    const event = eventType === 'rename' ? 'rename' : 'change';
    const fullPath = path.resolve(root, name);
    if (this.shouldIgnore(fullPath, root)) {
      return;
    }

    this.pending.set(fullPath, { eventType: event, root });
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      void this.flushPending();
    }, this.debounceMs);
  }

  private async flushPending(): Promise<void> {
    const entries = Array.from(this.pending.entries());
    this.pending.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    for (const [fullPath, info] of entries) {
      try {
        const op = await this.resolveOperation(fullPath, info.eventType);
        if (!op) {
          continue;
        }

        await resolvePathWithinWorkspace(fullPath, this.getWorkspaceRoot(), {
          requireExisting: op !== 'deleted',
        });

        await this.traceService.recordFileChange({
          path: fullPath,
          op,
          actor: 'human',
        });
      } catch (error) {
        if (error instanceof WorkspacePathError) {
          continue;
        }
        // Ignore errors from transient file operations or permissions.
      }
    }
  }

  private async resolveOperation(
    fullPath: string,
    eventType: 'rename' | 'change'
  ): Promise<'modified' | 'added' | 'deleted' | null> {
    if (eventType === 'change') {
      const stat = await this.safeStat(fullPath);
      if (!stat || stat.isDirectory()) {
        return null;
      }
      return 'modified';
    }

    const exists = fs.existsSync(fullPath);
    if (!exists) {
      return 'deleted';
    }

    const stat = await this.safeStat(fullPath);
    if (!stat || stat.isDirectory()) {
      return null;
    }
    return 'added';
  }

  private async safeStat(fullPath: string): Promise<fs.Stats | null> {
    try {
      return await fs.promises.stat(fullPath);
    } catch {
      return null;
    }
  }

  private resolveTrackRoots(workspaceRoot: string, roots?: string[]): string[] {
    if (!roots || roots.length === 0) {
      return [workspaceRoot];
    }

    const resolvedRoots: string[] = [];
    for (const root of roots) {
      const candidate = path.isAbsolute(root)
        ? root
        : path.join(workspaceRoot, root);
      try {
        const resolved = path.resolve(candidate);
        if (!isPathWithinRoot(resolved, workspaceRoot)) {
          continue;
        }
        if (!fs.existsSync(resolved)) {
          continue;
        }
        resolvedRoots.push(resolved);
      } catch {
        // Ignore invalid roots.
      }
    }

    return resolvedRoots.length > 0 ? resolvedRoots : [workspaceRoot];
  }

  private shouldIgnore(fullPath: string, root: string): boolean {
    const relative = path.relative(root, fullPath);
    if (!relative || relative.startsWith('..')) {
      return true;
    }
    const segments = relative.split(path.sep);
    return segments.some((segment) => DEFAULT_IGNORED_DIRS.has(segment));
  }

  private getWorkspaceRoot(): string {
    const workspace = this.workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder first.');
    }
    return workspace.path;
  }
}

export const sddWatcher = SddWatcher.getInstance();
