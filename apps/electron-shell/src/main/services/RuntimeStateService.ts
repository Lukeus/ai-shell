import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

type RuntimeState = {
  safeMode: boolean;
  recentCrashes: string[];
  rendererCrashCount?: number;
};

const RuntimeStateSchema = z.object({
  safeMode: z.boolean().optional(),
  recentCrashes: z.array(z.string()).optional(),
  rendererCrashCount: z.number().int().min(0).optional(),
});

const DEFAULT_STATE: RuntimeState = {
  safeMode: false,
  recentCrashes: [],
  rendererCrashCount: 0,
};

const CRASH_WINDOW_MS = 60_000;
const CRASH_THRESHOLD = 3;

/**
 * RuntimeStateService - persists crash-loop and safe mode state under userData.
 */
export class RuntimeStateService {
  private static instance: RuntimeStateService | null = null;
  private readonly statePath: string;
  private cachedState: RuntimeState | null = null;

  private constructor() {
    this.statePath = path.join(app.getPath('userData'), 'runtime-state.json');
  }

  public static getInstance(): RuntimeStateService {
    if (!RuntimeStateService.instance) {
      RuntimeStateService.instance = new RuntimeStateService();
    }
    return RuntimeStateService.instance;
  }

  public getState(): RuntimeState {
    if (this.cachedState) {
      return this.cachedState;
    }
    const loaded = this.readStateFromDisk();
    const pruned = this.pruneCrashes(loaded, Date.now());
    if (pruned !== loaded) {
      this.writeStateToDisk(pruned);
    }
    this.cachedState = pruned;
    return pruned;
  }

  public setSafeMode(enabled: boolean): RuntimeState {
    const state = this.getState();
    const next: RuntimeState = {
      ...state,
      safeMode: enabled,
    };
    this.writeStateToDisk(next);
    this.cachedState = next;
    return next;
  }

  public recordMainCrash(): { state: RuntimeState; crashCount: number; safeModeEnabled: boolean } {
    const now = Date.now();
    const state = this.getState();
    const recent = this.pruneCrashTimestamps(state.recentCrashes, now);
    recent.push(new Date(now).toISOString());
    const crashCount = recent.length;
    const safeModeEnabled = state.safeMode || crashCount >= CRASH_THRESHOLD;
    const next: RuntimeState = {
      ...state,
      safeMode: safeModeEnabled,
      recentCrashes: recent,
    };
    this.writeStateToDisk(next);
    this.cachedState = next;
    return { state: next, crashCount, safeModeEnabled };
  }

  public recordRendererCrash(): RuntimeState {
    const state = this.getState();
    const next: RuntimeState = {
      ...state,
      rendererCrashCount: (state.rendererCrashCount ?? 0) + 1,
    };
    this.writeStateToDisk(next);
    this.cachedState = next;
    return next;
  }

  public markStableRun(): RuntimeState {
    const state = this.getState();
    if (state.recentCrashes.length === 0) {
      return state;
    }
    const next: RuntimeState = {
      ...state,
      recentCrashes: [],
    };
    this.writeStateToDisk(next);
    this.cachedState = next;
    return next;
  }

  private readStateFromDisk(): RuntimeState {
    try {
      if (!fs.existsSync(this.statePath)) {
        return { ...DEFAULT_STATE };
      }
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return this.normalizeState(parsed);
    } catch (error) {
      console.warn(
        '[RuntimeStateService] Failed to read runtime state, resetting:',
        error instanceof Error ? error.message : String(error)
      );
      return { ...DEFAULT_STATE };
    }
  }

  private normalizeState(value: unknown): RuntimeState {
    const parsed = RuntimeStateSchema.safeParse(value);
    if (!parsed.success) {
      return { ...DEFAULT_STATE };
    }
    const data = parsed.data;
    return {
      safeMode: data.safeMode ?? false,
      recentCrashes: this.normalizeCrashTimestamps(data.recentCrashes ?? []),
      rendererCrashCount: data.rendererCrashCount ?? 0,
    };
  }

  private normalizeCrashTimestamps(values: string[]): string[] {
    const normalized: string[] = [];
    for (const value of values) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.valueOf())) {
        continue;
      }
      normalized.push(parsed.toISOString());
    }
    return normalized;
  }

  private pruneCrashes(state: RuntimeState, nowMs: number): RuntimeState {
    const trimmed = this.pruneCrashTimestamps(state.recentCrashes, nowMs);
    if (trimmed.length === state.recentCrashes.length) {
      return state;
    }
    return {
      ...state,
      recentCrashes: trimmed,
    };
  }

  private pruneCrashTimestamps(values: string[], nowMs: number): string[] {
    const cutoff = nowMs - CRASH_WINDOW_MS;
    return values.filter((value) => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) && parsed >= cutoff;
    });
  }

  private writeStateToDisk(state: RuntimeState): void {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error(
        '[RuntimeStateService] Failed to persist runtime state:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

export const runtimeStateService = RuntimeStateService.getInstance();
