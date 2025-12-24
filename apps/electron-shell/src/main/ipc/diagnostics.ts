import { app, BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  DiagFatalEventSchema,
  DiagGetLogPathResponseSchema,
  DiagSetSafeModeRequestSchema,
  DiagSetSafeModeResponseSchema,
  ErrorReportSchema,
  type ErrorReport,
} from 'packages-api-contracts';
import { handleSafe } from './safeIpc';
import { diagnosticsService } from '../services/DiagnosticsService';
import { runtimeStateService } from '../services/RuntimeStateService';

export const registerDiagnosticsHandlers = (): void => {
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
