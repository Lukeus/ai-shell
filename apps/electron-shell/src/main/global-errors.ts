import { app, type BrowserWindow, type ChildProcessGoneDetails, type RenderProcessGoneDetails } from 'electron';
import type { ErrorReport } from 'packages-api-contracts';
import { diagnosticsService } from './services/DiagnosticsService';
import { runtimeStateService } from './services/RuntimeStateService';
import { publishFatalDiagnostics } from './ipc/diagnostics';

const HANDLERS_FLAG = '__aiShellGlobalErrorHandlersInstalled';
const WINDOW_CRASH_WINDOW_MS = 30_000;
const WINDOW_CRASH_RECREATE_THRESHOLD = 2;

const windowCrashHistory = new Map<number, number[]>();
let fatalHandling = false;

const buildErrorReport = (
  source: ErrorReport['source'],
  error: unknown,
  context?: Record<string, string | number | boolean | null>
): ErrorReport => {
  if (error instanceof Error) {
    return {
      source,
      message: error.message || 'Unknown error',
      name: error.name || undefined,
      stack: error.stack || undefined,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      source,
      message: error.trim(),
      timestamp: new Date().toISOString(),
      context,
    };
  }

  return {
    source,
    message: 'Unknown error',
    timestamp: new Date().toISOString(),
    context,
  };
};

const reportNonFatal = (report: ErrorReport): void => {
  void diagnosticsService.reportError(report);
};

const handleFatal = async (kind: string, error: unknown): Promise<void> => {
  if (fatalHandling) {
    return;
  }
  fatalHandling = true;

  const report = buildErrorReport('main', error, {
    fatalKind: kind,
    reasonType: typeof error,
  });

  try {
    await publishFatalDiagnostics(report);
  } catch {
    // Ignore logging failures during fatal shutdown.
  }

  runtimeStateService.recordMainCrash();

  try {
    app.relaunch();
  } finally {
    app.exit(1);
  }
};

const shouldRecoverRenderer = (details: RenderProcessGoneDetails): boolean => {
  return details.reason !== 'clean-exit';
};

const recordWindowCrash = (windowId: number): number => {
  const now = Date.now();
  const history = windowCrashHistory.get(windowId) ?? [];
  const recent = history.filter((timestamp) => now - timestamp <= WINDOW_CRASH_WINDOW_MS);
  recent.push(now);
  windowCrashHistory.set(windowId, recent);
  return recent.length;
};

const reportRendererCrash = (details: RenderProcessGoneDetails, webContentsId?: number): void => {
  const report = buildErrorReport('renderer', `Renderer process gone: ${details.reason}`, {
    reason: details.reason,
    exitCode: typeof details.exitCode === 'number' ? details.exitCode : null,
    crashType: details.reason,
    webContentsId: typeof webContentsId === 'number' ? webContentsId : null,
  });
  reportNonFatal(report);
};

const reportChildProcessGone = (details: ChildProcessGoneDetails): void => {
  const serviceName =
    'serviceName' in details && typeof details.serviceName === 'string'
      ? details.serviceName
      : null;
  const report = buildErrorReport('main', `Child process gone: ${details.type}`, {
    type: details.type,
    reason: details.reason,
    exitCode: typeof details.exitCode === 'number' ? details.exitCode : null,
    serviceName,
  });
  reportNonFatal(report);
};

/**
 * Install global process/app error handlers for main process crashes.
 */
export const installGlobalErrorHandlers = (): void => {
  const globalState = globalThis as typeof globalThis & {
    __aiShellGlobalErrorHandlersInstalled?: boolean;
  };

  if (globalState[HANDLERS_FLAG]) {
    return;
  }
  globalState[HANDLERS_FLAG] = true;

  process.on('uncaughtException', (error) => {
    void handleFatal('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason) => {
    void handleFatal('unhandledRejection', reason);
  });

  app.on('render-process-gone', (_event, webContents, details) => {
    if (!shouldRecoverRenderer(details)) {
      return;
    }
    runtimeStateService.recordRendererCrash();
    reportRendererCrash(details, webContents?.id);
  });

  app.on('child-process-gone', (_event, details) => {
    reportChildProcessGone(details);
  });
};

/**
 * Attach renderer crash recovery policy to a BrowserWindow instance.
 */
export const attachWindowCrashRecovery = (
  window: BrowserWindow,
  recreateWindow: () => void
): void => {
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!shouldRecoverRenderer(details)) {
      return;
    }

    const crashCount = recordWindowCrash(window.id);
    if (crashCount < WINDOW_CRASH_RECREATE_THRESHOLD) {
      if (!window.isDestroyed()) {
        window.reload();
      }
      return;
    }

    if (!window.isDestroyed()) {
      window.destroy();
    }
    windowCrashHistory.delete(window.id);
    recreateWindow();
  });

  window.on('closed', () => {
    windowCrashHistory.delete(window.id);
  });
};
