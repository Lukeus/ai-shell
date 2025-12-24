import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { ErrorReport, ErrorSource } from 'packages-api-contracts';

type LogContext = Record<string, string | number | boolean | null>;

type DiagnosticsLogEntry = {
  id: string;
  source: ErrorSource;
  message: string;
  name?: string;
  stack?: string;
  timestamp: string;
  context?: LogContext;
};

export const DIAGNOSTICS_LIMITS = {
  message: 1000,
  name: 200,
  stack: 8000,
  contextEntries: 50,
  contextValue: 500,
  maxLogBytes: 5 * 1024 * 1024,
} as const;

const LOG_DIRNAME = 'logs';
const LOG_FILENAME = 'ai-shell.log';
const ROTATED_LOG_FILENAME = 'ai-shell.log.1';
const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|session|api[-_]?key|env)/i;

/**
 * DiagnosticsService - writes sanitized error reports to a local log.
 */
export class DiagnosticsService {
  private static instance: DiagnosticsService | null = null;
  private readonly logDir: string;
  private readonly logPath: string;

  private constructor() {
    const userData = app.getPath('userData');
    this.logDir = path.join(userData, LOG_DIRNAME);
    this.logPath = path.join(this.logDir, LOG_FILENAME);
  }

  public static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService();
    }
    return DiagnosticsService.instance;
  }

  public async reportError(report: ErrorReport): Promise<boolean> {
    const entry = this.buildEntry(report);
    return this.appendEntry(entry);
  }

  public async getLogPath(): Promise<string> {
    await this.ensureLogDir();
    return this.logPath;
  }

  private async appendEntry(entry: DiagnosticsLogEntry): Promise<boolean> {
    try {
      await this.ensureLogDir();
      await this.rotateIfNeeded();
      await fs.promises.appendFile(this.logPath, `${JSON.stringify(entry)}\n`, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  private buildEntry(report: ErrorReport): DiagnosticsLogEntry {
    const sanitized = this.sanitizeReport(report);
    return {
      id: randomUUID(),
      ...sanitized,
    };
  }

  private sanitizeReport(report: ErrorReport): Omit<DiagnosticsLogEntry, 'id'> {
    const message =
      this.sanitizeString(report.message, DIAGNOSTICS_LIMITS.message) || 'Unknown error';
    const name = this.sanitizeString(report.name, DIAGNOSTICS_LIMITS.name);
    const stack = this.sanitizeString(report.stack, DIAGNOSTICS_LIMITS.stack);
    const context = this.sanitizeContext(report.context);
    return {
      source: report.source,
      message,
      name: name || undefined,
      stack: stack || undefined,
      timestamp: this.sanitizeTimestamp(report.timestamp),
      context,
    };
  }

  private sanitizeTimestamp(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) {
      return undefined;
    }
    const entries = Object.entries(context).filter(
      ([key]) => key.trim().length > 0 && !SENSITIVE_KEY_PATTERN.test(key)
    );
    if (entries.length === 0) {
      return undefined;
    }

    const sanitized: LogContext = {};
    for (const [key, value] of entries.slice(0, DIAGNOSTICS_LIMITS.contextEntries)) {
      sanitized[key] =
        typeof value === 'string'
          ? this.sanitizeString(value, DIAGNOSTICS_LIMITS.contextValue)
          : value;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private sanitizeString(value: string | undefined, maxLength: number): string {
    const normalized = (value ?? '').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    const trimLength = Math.max(0, maxLength - 3);
    return `${normalized.slice(0, trimLength).trimEnd()}...`;
  }

  private async ensureLogDir(): Promise<void> {
    await fs.promises.mkdir(this.logDir, { recursive: true });
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stat = await fs.promises.stat(this.logPath);
      if (stat.size <= DIAGNOSTICS_LIMITS.maxLogBytes) {
        return;
      }
      const rotatedPath = path.join(this.logDir, ROTATED_LOG_FILENAME);
      await fs.promises.rm(rotatedPath, { force: true });
      await fs.promises.rename(this.logPath, rotatedPath);
    } catch (error) {
      if (!this.isMissingPathError(error)) {
        throw error;
      }
    }
  }

  private isMissingPathError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR';
  }
}

export const diagnosticsService = DiagnosticsService.getInstance();
