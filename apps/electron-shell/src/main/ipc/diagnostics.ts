import { app, BrowserWindow, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  ClearDiagnosticsRequestSchema,
  DiagnosticsSummaryEventSchema,
  DiagnosticsUpdateEventSchema,
  DiagFatalEventSchema,
  DiagGetLogPathResponseSchema,
  ListDiagnosticsRequestSchema,
  ListDiagnosticsResponseSchema,
  PublishDiagnosticsRequestSchema,
  DiagSetSafeModeRequestSchema,
  DiagSetSafeModeResponseSchema,
  ErrorReportSchema,
  type Diagnostic,
  type DiagnosticsSummaryEvent,
  type ErrorReport,
} from 'packages-api-contracts';
import { handleSafe } from './safeIpc';
import { diagnosticsService } from '../services/DiagnosticsService';
import { runtimeStateService } from '../services/RuntimeStateService';

const diagnosticsByKey = new Map<string, Diagnostic[]>();

const keyFor = (filePath: string, source: string): string => `${filePath}::${source}`;

const listAllDiagnostics = (): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const items of diagnosticsByKey.values()) {
    diagnostics.push(...items);
  }
  return diagnostics;
};

const buildSummary = (diagnostics: Diagnostic[]): DiagnosticsSummaryEvent => {
  const summary: DiagnosticsSummaryEvent = {
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    hintCount: 0,
  };

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') summary.errorCount += 1;
    if (diagnostic.severity === 'warning') summary.warningCount += 1;
    if (diagnostic.severity === 'info') summary.infoCount += 1;
    if (diagnostic.severity === 'hint') summary.hintCount += 1;
  }

  return summary;
};

const publishDiagnosticsUpdate = (filePath: string, source: string, diagnostics: Diagnostic[]): void => {
  const payload = DiagnosticsUpdateEventSchema.parse({
    filePath,
    source,
    diagnostics,
  });

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      continue;
    }
    try {
      window.webContents.send(IPC_CHANNELS.DIAGNOSTICS_ON_UPDATE, payload);
    } catch {
      // Ignore send failures during teardown.
    }
  }
};

const publishDiagnosticsSummary = (): void => {
  const summary = DiagnosticsSummaryEventSchema.parse(buildSummary(listAllDiagnostics()));
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      continue;
    }
    try {
      window.webContents.send(IPC_CHANNELS.DIAGNOSTICS_ON_SUMMARY, summary);
    } catch {
      // Ignore send failures during teardown.
    }
  }
};

export const registerDiagnosticsHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_PUBLISH,
    async (_event, request: unknown): Promise<void> => {
      const validated = PublishDiagnosticsRequestSchema.parse(request);
      const key = keyFor(validated.filePath, validated.source);

      if (validated.diagnostics.length === 0) {
        diagnosticsByKey.delete(key);
      } else {
        diagnosticsByKey.set(key, validated.diagnostics);
      }

      publishDiagnosticsUpdate(validated.filePath, validated.source, validated.diagnostics);
      publishDiagnosticsSummary();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_CLEAR,
    async (_event, request: unknown): Promise<void> => {
      const validated = ClearDiagnosticsRequestSchema.parse(request ?? {});
      const updates: Array<{ filePath: string; source: string }> = [];

      for (const key of Array.from(diagnosticsByKey.keys())) {
        const [filePath, source] = key.split('::');
        if (!filePath || !source) {
          continue;
        }
        if (validated.filePath && validated.filePath !== filePath) {
          continue;
        }
        if (validated.source && validated.source !== source) {
          continue;
        }
        diagnosticsByKey.delete(key);
        updates.push({ filePath, source });
      }

      for (const update of updates) {
        publishDiagnosticsUpdate(update.filePath, update.source, []);
      }
      publishDiagnosticsSummary();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_LIST,
    async (_event, request: unknown) => {
      const validated = ListDiagnosticsRequestSchema.parse(request ?? {});
      const diagnostics = listAllDiagnostics().filter((diagnostic) => {
        if (validated.severity && diagnostic.severity !== validated.severity) {
          return false;
        }
        if (validated.source && diagnostic.source !== validated.source) {
          return false;
        }
        return true;
      });

      diagnostics.sort((a, b) => {
        const severityRank = { error: 0, warning: 1, info: 2, hint: 3 } as const;
        const severityDiff = severityRank[a.severity] - severityRank[b.severity];
        if (severityDiff !== 0) {
          return severityDiff;
        }
        const pathDiff = a.filePath.localeCompare(b.filePath);
        if (pathDiff !== 0) {
          return pathDiff;
        }
        const lineDiff = a.location.startLine - b.location.startLine;
        if (lineDiff !== 0) {
          return lineDiff;
        }
        return a.location.startColumn - b.location.startColumn;
      });

      return ListDiagnosticsResponseSchema.parse({
        diagnostics,
        summary: buildSummary(diagnostics),
      });
    }
  );

  handleSafe(IPC_CHANNELS.DIAG_REPORT_ERROR, { inputSchema: ErrorReportSchema }, async (
    _event,
    report
  ) => {
    await diagnosticsService.reportError(report);
  });

  handleSafe(IPC_CHANNELS.DIAG_GET_LOG_PATH, { outputSchema: DiagGetLogPathResponseSchema }, async () => {
    const logPath = await diagnosticsService.getLogPath();
    return { path: logPath };
  });

  handleSafe(
    IPC_CHANNELS.DIAG_SET_SAFE_MODE,
    { inputSchema: DiagSetSafeModeRequestSchema, outputSchema: DiagSetSafeModeResponseSchema },
    async (_event, request) => {
      const next = runtimeStateService.setSafeMode(request.enabled);
      // Delay relaunch to allow IPC response to resolve before exit.
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 100);
      return { enabled: next.safeMode };
    }
  );
};

export const publishFatalDiagnostics = async (report: ErrorReport): Promise<void> => {
  const parsed = ErrorReportSchema.safeParse(report);
  const payload = DiagFatalEventSchema.parse({
    report: parsed.success
      ? parsed.data
      : {
          source: 'main',
          message: 'Fatal error',
          timestamp: new Date().toISOString(),
        },
  });

  await diagnosticsService.reportError(payload.report);

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    try {
      window.webContents.send(IPC_CHANNELS.DIAG_ON_FATAL, payload);
    } catch {
      // Ignore send failures during shutdown.
    }
  }
};
