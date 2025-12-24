import type { ErrorReport } from 'packages-api-contracts';

const HANDLERS_FLAG = '__aiShellRendererErrorHandlersInstalled';

const shouldIgnoreRejection = (event: PromiseRejectionEvent): boolean => {
  const reason = event.reason as { name?: string; message?: string; stack?: string } | null;
  if (!reason || typeof reason !== 'object') {
    return false;
  }
  const isCanceled = reason.name === 'Canceled' || reason.message?.includes('Canceled');
  const fromMonaco = typeof reason.stack === 'string' && reason.stack.includes('monaco-editor');
  return Boolean(isCanceled && fromMonaco);
};

const reportError = (report: ErrorReport): void => {
  if (typeof window?.api?.diagnostics?.reportError !== 'function') {
    return;
  }
  void window.api.diagnostics.reportError(report);
};

const buildErrorReport = (
  error: unknown,
  context?: Record<string, string | number | boolean | null>
): ErrorReport => {
  if (error instanceof Error) {
    return {
      source: 'renderer',
      message: error.message || 'Unknown error',
      name: error.name || undefined,
      stack: error.stack || undefined,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      source: 'renderer',
      message: error.trim(),
      timestamp: new Date().toISOString(),
      context,
    };
  }

  return {
    source: 'renderer',
    message: 'Unknown error',
    timestamp: new Date().toISOString(),
    context,
  };
};

/**
 * Installs global renderer error listeners and forwards sanitized reports to main.
 */
export const installGlobalErrorHandlers = (): void => {
  const globalState = globalThis as typeof globalThis & {
    __aiShellRendererErrorHandlersInstalled?: boolean;
  };

  if (globalState[HANDLERS_FLAG]) {
    return;
  }
  globalState[HANDLERS_FLAG] = true;

  window.addEventListener(
    'error',
    (event) => {
      const context = {
        filename: event.filename || null,
        line: typeof event.lineno === 'number' ? event.lineno : null,
        column: typeof event.colno === 'number' ? event.colno : null,
      };
      reportError(buildErrorReport(event.error ?? event.message, context));
    },
    { capture: true }
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (shouldIgnoreRejection(event)) {
        event.preventDefault();
        return;
      }
      reportError(buildErrorReport(event.reason));
    },
    { capture: true }
  );
};
