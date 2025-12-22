/**
 * ExtensionHostManager - Spawns and manages the Extension Host child process.
 * 
 * P1 (Process Isolation): Extension Host runs as separate Node.js process.
 * Communicates via JSON-RPC over stdin/stdout.
 * Implements crash recovery with exponential backoff.
 */

import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { JSONRPCBroker } from './json-rpc-broker';
import { ExtensionStateManager } from './extension-state-manager';
import { buildChildProcessEnv } from './child-env';

interface ExtensionHostConfig {
  /** Path to Extension Host executable */
  extensionHostPath: string;
  /** Extensions directory */
  extensionsDir: string;
  /** Extension state manager (optional) */
  stateManager?: ExtensionStateManager;
}

/**
 * Manages the Extension Host child process lifecycle.
 */
export class ExtensionHostManager {
  private childProcess: ChildProcess | null = null;
  private rpcBroker: JSONRPCBroker | null = null;
  private config: ExtensionHostConfig;
  private isShuttingDown = false;
  private crashCount = 0;
  private lastCrashTime = 0;
  private restartTimeouts: number[] = [100, 500, 2000, 10000, 30000]; // Exponential backoff
  private currentTimeoutIndex = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private stateManager: ExtensionStateManager | null = null;

  constructor(config: ExtensionHostConfig) {
    this.config = config;
    this.stateManager = config.stateManager || null;
  }

  /**
   * Starts the Extension Host process.
   */
  public async start(): Promise<void> {
    if (this.childProcess) {
      console.warn('[ExtensionHostManager] Extension Host already running');
      return;
    }

    console.log('[ExtensionHostManager] Starting Extension Host...');
    
    try {
      // Spawn Extension Host as Node.js child process
      // P1: Using fork() for separate process with IPC communication
      this.childProcess = fork(this.config.extensionHostPath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'], // stdin, stdout, stderr, ipc
        env: buildChildProcessEnv({
          extra: {
            EXTENSIONS_DIR: this.config.extensionsDir,
            NODE_ENV: process.env.NODE_ENV || 'production',
          },
        }),
        cwd: app.getPath('userData'),
      });

      // Set up JSON-RPC broker for stdin/stdout communication
      this.rpcBroker = new JSONRPCBroker(
        this.childProcess.stdin!,
        this.childProcess.stdout!
      );

      // Monitor child process health
      this.setupProcessMonitoring();

      console.log('[ExtensionHostManager] Extension Host started with PID:', this.childProcess.pid);
      
      // Reset crash tracking on successful start
      this.crashCount = 0;
      this.currentTimeoutIndex = 0;
    } catch (error) {
      console.error('[ExtensionHostManager] Failed to start Extension Host:', error);
      this.childProcess = null;
      this.rpcBroker = null;
      throw error;
    }
  }

  /**
   * Stops the Extension Host process gracefully.
   */
  public async stop(): Promise<void> {
    this.isShuttingDown = true;

    // Clear any pending restart timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (!this.childProcess) {
      return;
    }

    console.log('[ExtensionHostManager] Stopping Extension Host...');

    try {
      // Send shutdown notification via JSON-RPC
      if (this.rpcBroker) {
        await this.rpcBroker.sendNotification('shutdown', {});
      }

      // Give process time to shut down gracefully (5 seconds)
      await this.waitForExit(5000);
    } catch (error) {
      console.error('[ExtensionHostManager] Error during graceful shutdown:', error);
    }

    // Force kill if still running
    if (this.childProcess && !this.childProcess.killed) {
      console.warn('[ExtensionHostManager] Force killing Extension Host');
      this.childProcess.kill('SIGKILL');
    }

    this.cleanup();
  }

  /**
   * Sends a JSON-RPC request to Extension Host.
   */
  public async sendRequest(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    if (!this.rpcBroker) {
      throw new Error('Extension Host not running');
    }

    return this.rpcBroker.sendRequest(method, params, timeoutMs);
  }

  /**
   * Sends a JSON-RPC notification to Extension Host (no response expected).
   */
  public sendNotification(method: string, params?: unknown): void {
    if (!this.rpcBroker) {
      throw new Error('Extension Host not running');
    }

    this.rpcBroker.sendNotification(method, params);
  }

  /**
   * Registers a handler for JSON-RPC requests from Extension Host.
   */
  public onRequest(method: string, handler: (params: unknown) => Promise<unknown> | unknown): void {
    if (!this.rpcBroker) {
      throw new Error('Extension Host not running');
    }

    this.rpcBroker.onRequest(method, handler);
  }

  /**
   * Registers a handler for JSON-RPC notifications from Extension Host.
   */
  public onNotification(method: string, handler: (params: unknown) => void): void {
    if (!this.rpcBroker) {
      throw new Error('Extension Host not running');
    }

    this.rpcBroker.onNotification(method, handler);
  }

  /**
   * Checks if Extension Host is running.
   */
  public isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }

  /**
   * Sets up monitoring for child process lifecycle.
   */
  private setupProcessMonitoring(): void {
    if (!this.childProcess) {
      return;
    }

    // Handle process exit
    this.childProcess.on('exit', (code, signal) => {
      console.log(`[ExtensionHostManager] Extension Host exited with code ${code} and signal ${signal}`);
      
      if (!this.isShuttingDown) {
        this.handleCrash();
      } else {
        this.cleanup();
      }
    });

    // Handle process errors
    this.childProcess.on('error', (error) => {
      console.error('[ExtensionHostManager] Extension Host process error:', error);
      if (!this.isShuttingDown) {
        this.handleCrash();
      }
    });

    // Forward stderr to console (for debugging)
    if (this.childProcess.stderr) {
      this.childProcess.stderr.on('data', (data) => {
        console.error('[ExtensionHost]', data.toString().trim());
      });
    }
  }

  /**
   * Handles Extension Host crash and implements restart logic.
   */
  private handleCrash(): void {
    const now = Date.now();
    
    // Track crash rate: if 5+ crashes within 1 minute, stop auto-restart
    if (now - this.lastCrashTime < 60000) {
      this.crashCount++;
    } else {
      this.crashCount = 1;
      this.currentTimeoutIndex = 0;
    }
    
    this.lastCrashTime = now;

    console.error(`[ExtensionHostManager] Extension Host crashed (crash count: ${this.crashCount})`);
    
    // Task 9 invariant: All extensions marked inactive after crash
    if (this.stateManager) {
      this.stateManager.markAllInactive('Extension Host crashed');
    }

    // Stop auto-restart after 5 crashes in 1 minute
    if (this.crashCount >= 5) {
      console.error('[ExtensionHostManager] Too many crashes, disabling auto-restart. Manual intervention required.');
      this.cleanup();
      return;
    }

    // Calculate backoff delay
    const delay = this.restartTimeouts[Math.min(this.currentTimeoutIndex, this.restartTimeouts.length - 1)];
    this.currentTimeoutIndex++;

    console.log(`[ExtensionHostManager] Restarting Extension Host in ${delay}ms...`);

    // Clean up current process
    this.cleanup();

    // Schedule restart with exponential backoff
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start().catch((error) => {
        console.error('[ExtensionHostManager] Failed to restart Extension Host:', error);
      });
    }, delay);
  }

  /**
   * Cleans up resources.
   */
  private cleanup(): void {
    if (this.rpcBroker) {
      this.rpcBroker.close();
      this.rpcBroker = null;
    }

    this.childProcess = null;
  }

  /**
   * Waits for process to exit or timeout.
   */
  private waitForExit(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.childProcess || this.childProcess.killed) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        resolve();
      }, timeoutMs);

      this.childProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}
