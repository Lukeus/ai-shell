/**
 * ErrorHandler - Global error handling for Extension Host.
 * 
 * P1 (Process Isolation): Prevents Extension Host from crashing the main process.
 * Catches and logs unhandled errors, allowing the process to continue or exit gracefully.
 * 
 * Task 9 Invariant: Extension errors caught and wrapped, never crash Extension Host unexpectedly.
 */

/**
 * Error handler callback type.
 */
export type ErrorCallback = (error: Error, context: string) => void;

/**
 * ErrorHandler manages global error handling for the Extension Host process.
 */
export class ErrorHandler {
  private errorCallbacks: ErrorCallback[] = [];
  private isShuttingDown = false;

  constructor() {
    this.setupGlobalHandlers();
  }

  /**
   * Register a callback for error notifications.
   * Useful for logging errors to main process or telemetry.
   */
  public onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Mark that the process is shutting down.
   * Prevents restart attempts during intentional shutdown.
   */
  public setShuttingDown(shuttingDown: boolean): void {
    this.isShuttingDown = shuttingDown;
  }

  /**
   * Sets up global error handlers.
   */
  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    // Task 9: Extension errors caught and wrapped, never crash Extension Host
    process.on('uncaughtException', (error: Error) => {
      this.handleError(error, 'uncaughtException');
      
      // Don't exit - log and continue
      // Extension Host should remain available for other extensions
      console.error('[ErrorHandler] Uncaught exception handled, process continuing');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError(error, 'unhandledRejection');
      
      // Don't exit - log and continue
      console.error('[ErrorHandler] Unhandled rejection handled, process continuing');
    });

    // Handle warnings
    process.on('warning', (warning: Error) => {
      console.warn('[ErrorHandler] Process warning:', warning.name, warning.message);
      if (warning.stack) {
        console.warn(warning.stack);
      }
    });

    // Handle SIGTERM gracefully
    process.on('SIGTERM', () => {
      console.log('[ErrorHandler] SIGTERM received, shutting down gracefully');
      this.isShuttingDown = true;
      process.exit(0);
    });

    // Handle SIGINT gracefully (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('[ErrorHandler] SIGINT received, shutting down gracefully');
      this.isShuttingDown = true;
      process.exit(0);
    });
  }

  /**
   * Handles an error by notifying callbacks and logging.
   */
  private handleError(error: Error, context: string): void {
    // Log error details
    console.error(`[ErrorHandler] Error in ${context}:`, error.message);
    if (error.stack) {
      console.error('[ErrorHandler] Stack trace:', error.stack);
    }

    // Notify error callbacks (e.g., send to main process)
    for (const callback of this.errorCallbacks) {
      try {
        callback(error, context);
      } catch (callbackError) {
        console.error('[ErrorHandler] Error in error callback:', callbackError);
      }
    }
  }

  /**
   * Manually report an error.
   * Useful for reporting errors from try/catch blocks.
   */
  public reportError(error: Error, context: string): void {
    this.handleError(error, context);
  }
}
