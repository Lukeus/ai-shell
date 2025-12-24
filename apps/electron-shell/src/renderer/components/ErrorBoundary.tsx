import React from 'react';
import type { ErrorReport } from 'packages-api-contracts';
import { CrashScreen } from './CrashScreen';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  logPath: string | null;
  logError: string | null;
  isLoadingLogs: boolean;
};

const buildErrorReport = (error: Error, componentStack?: string): ErrorReport => ({
  source: 'renderer',
  message: error.message || 'Unknown error',
  name: error.name || undefined,
  stack: error.stack || undefined,
  timestamp: new Date().toISOString(),
  context: componentStack ? { componentStack } : undefined,
});

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    error: null,
    logPath: null,
    logError: null,
    isLoadingLogs: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (typeof window?.api?.diagnostics?.reportError === 'function') {
      void window.api.diagnostics.reportError(buildErrorReport(error, info.componentStack));
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleRestartSafeMode = async (): Promise<void> => {
    if (typeof window?.api?.diagnostics?.setSafeMode === 'function') {
      const result = await window.api.diagnostics.setSafeMode({ enabled: true });
      if (result.ok) {
        return;
      }
    }

    if (typeof window?.api?.diagnostics?.reportError === 'function') {
      const report: ErrorReport = {
        source: 'renderer',
        message: 'Safe Mode restart requested.',
        timestamp: new Date().toISOString(),
        context: { action: 'restart-safe-mode' },
      };
      void window.api.diagnostics.reportError(report);
    }

    window.location.reload();
  };

  private handleOpenLogs = async (): Promise<void> => {
    if (typeof window?.api?.diagnostics?.getLogPath !== 'function') {
      this.setState({ logError: 'Log path unavailable.' });
      return;
    }

    this.setState({ isLoadingLogs: true, logError: null });
    const result = await window.api.diagnostics.getLogPath();
    if (result.ok) {
      this.setState({
        logPath: result.value.path,
        isLoadingLogs: false,
        logError: null,
      });
      return;
    }

    this.setState({
      logPath: null,
      logError: result.error.message || 'Failed to load log path.',
      isLoadingLogs: false,
    });
  };

  private handleCopyLogPath = async (): Promise<void> => {
    const { logPath } = this.state;
    if (!logPath) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(logPath);
    } catch {
      // Ignore clipboard errors; path remains visible.
    }
  };

  public render(): React.ReactNode {
    const { error, logPath, logError, isLoadingLogs } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <CrashScreen
        title="Renderer crashed"
        message="The UI encountered a fatal error. Choose a recovery option to continue."
        details={error.message}
        logPath={logPath}
        logError={logError}
        isLoadingLogs={isLoadingLogs}
        onReload={this.handleReload}
        onRestartSafeMode={this.handleRestartSafeMode}
        onOpenLogs={this.handleOpenLogs}
        onCopyLogPath={logPath ? this.handleCopyLogPath : undefined}
      />
    );
  }
}
