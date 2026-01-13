import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  TerminalSession,
  CreateTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
} from 'packages-api-contracts';
import { settingsService } from './SettingsService';
import { isPathWithinRoot } from './workspace-paths';
import { buildChildProcessEnv } from './child-env';

/**
 * TerminalService - Singleton service for managing PTY sessions.
 * 
 * This service manages terminal sessions using node-pty for OS-level PTY operations.
 * All PTY operations run ONLY in the main process (P1: Process Isolation).
 * 
 * Security constraints (P2: Security Defaults, P3: Secrets):
 * - cwd restricted to workspace directory (validated on creation)
 * - Environment variables sanitized (allowlist only)
 * - Session IDs are UUIDs to prevent enumeration
 * - Max 10 concurrent sessions per app instance
 * - Terminal I/O is NEVER logged (may contain passwords, API keys, secrets)
 * 
 * @remarks
 * - This class MUST NOT log any terminal I/O data (pty.onData events)
 * - All cwd paths MUST be validated to be within workspace
 * - Environment variables MUST be sanitized before passing to PTY
 */
/**
 * Internal PTY session wrapper.
 */
interface PTYSession {
  id: string;
  ptyProcess: import('node-pty').IPty;
  metadata: TerminalSession;
}

type PtyModule = typeof import('node-pty');

type LoadedPty = {
  module: PtyModule;
  source: string;
};

type LoadPtyOptions = {
  preferPrebuilt?: boolean;
  forceReload?: boolean;
};

let cachedPty: LoadedPty | null = null;

function loadPtyModule(options: LoadPtyOptions = {}): LoadedPty {
  const { preferPrebuilt = false, forceReload = false } = options;

  if (cachedPty && !forceReload) {
    if (!preferPrebuilt || cachedPty.source === '@homebridge/node-pty-prebuilt-multiarch') {
      return cachedPty;
    }
  }

  const orderedCandidates = preferPrebuilt
    ? ['@homebridge/node-pty-prebuilt-multiarch', 'node-pty']
    : ['node-pty', '@homebridge/node-pty-prebuilt-multiarch'];
  const errors: string[] = [];

  for (const candidate of orderedCandidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require(candidate) as PtyModule;
      cachedPty = { module, source: candidate };
      return cachedPty;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }

  throw new Error(
    `Terminal backend unavailable. Install node-pty build tools or a prebuilt package.\n${errors.join('\n')}`
  );
}

function shouldRetryWithPrebuilt(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('conpty.node') || message.includes('MODULE_NOT_FOUND');
}

export class TerminalService extends EventEmitter {
  private static instance: TerminalService | null = null;
  private sessions: Map<string, PTYSession> = new Map();
  private readonly MAX_SESSIONS = 10;

  /**
   * Private constructor enforces singleton pattern.
   */
  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of TerminalService.
   * 
   * @returns The singleton TerminalService instance
   */
  public static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  /**
   * Create a new terminal session.
   * 
   * Security validations:
   * - Validates max session limit (10 concurrent sessions)
   * - Validates cwd is within workspaceRoot
   * - Sanitizes environment variables
   * - Generates UUID for session ID
   * 
   * @param request - Terminal creation request (cwd, env, shell, cols, rows)
   * @param workspaceRoot - Workspace root path for cwd validation (null if no workspace)
   * @returns Created terminal session metadata
   * @throws Error if max sessions exceeded or cwd outside workspace
   */
  public createSession(
    request: CreateTerminalRequest,
    workspaceRoot: string | null
  ): TerminalSession {
    // Validate max sessions
    if (this.sessions.size >= this.MAX_SESSIONS) {
      throw new Error(
        `Maximum number of terminal sessions (${this.MAX_SESSIONS}) exceeded`
      );
    }

    // Validate cwd is within workspace
    if (workspaceRoot) {
      const resolvedCwd = path.resolve(request.cwd);
      const resolvedWorkspace = path.resolve(workspaceRoot);

      let realCwd: string;
      let realWorkspace: string;
      try {
        realCwd = fs.realpathSync(resolvedCwd);
        realWorkspace = fs.realpathSync(resolvedWorkspace);
      } catch {
        throw new Error(
          `Terminal cwd must be within workspace. cwd: ${resolvedCwd}, workspace: ${resolvedWorkspace}`
        );
      }

      if (!isPathWithinRoot(realCwd, realWorkspace)) {
        throw new Error(
          `Terminal cwd must be within workspace. cwd: ${resolvedCwd}, workspace: ${resolvedWorkspace}`
        );
      }
    } else {
      // No workspace open - reject terminal creation
      throw new Error('Cannot create terminal: no workspace open');
    }

    // Generate session ID
    const sessionId = randomUUID();

    // Sanitize environment variables
    const sanitizedEnv = this.sanitizeEnv(request.env);

    // Determine shell (default to system shell)
    const shell = request.shell || this.getDefaultShell();

    const preferPrebuilt = process.platform === 'win32';
    let ptyLoader = loadPtyModule({ preferPrebuilt });

    let ptyProcess: import('node-pty').IPty;
    try {
      ptyProcess = ptyLoader.module.spawn(shell, [], {
        name: 'xterm-256color',
        cols: request.cols || 80,
        rows: request.rows || 24,
        cwd: request.cwd,
        env: sanitizedEnv,
      });
    } catch (error) {
      if (preferPrebuilt && shouldRetryWithPrebuilt(error) && ptyLoader.source !== '@homebridge/node-pty-prebuilt-multiarch') {
        ptyLoader = loadPtyModule({ preferPrebuilt: true, forceReload: true });
        ptyProcess = ptyLoader.module.spawn(shell, [], {
          name: 'xterm-256color',
          cols: request.cols || 80,
          rows: request.rows || 24,
          cwd: request.cwd,
          env: sanitizedEnv,
        });
      } else {
        throw error;
      }
    }

    // Create session metadata
    const metadata: TerminalSession = {
      sessionId,
      title: `Terminal ${this.sessions.size + 1}`,
      cwd: request.cwd,
      createdAt: new Date().toISOString(),
      status: 'running',
    };

    // Store session
    const session: PTYSession = {
      id: sessionId,
      ptyProcess,
      metadata,
    };
    this.sessions.set(sessionId, session);

    // Wire up PTY events
    // CRITICAL: DO NOT LOG ptyProcess.onData - may contain secrets
    ptyProcess.onData((data: string) => {
      const event: TerminalDataEvent = {
        sessionId,
        data,
      };
      this.emit('data', event);
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      const exitEvent: TerminalExitEvent = {
        sessionId,
        exitCode,
      };

      // Update session status
      const sess = this.sessions.get(sessionId);
      if (sess) {
        sess.metadata.status = 'exited';
        sess.metadata.exitCode = exitCode;
      }

      this.emit('exit', exitEvent);

      // Clean up session after exit
      this.sessions.delete(sessionId);
    });

    return metadata;
  }

  /**
   * Write data to a terminal session.
   * 
   * @param sessionId - Session ID to write to
   * @param data - Data to write (user input, control sequences)
   * @throws Error if session not found
   */
  public write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    session.ptyProcess.write(data);
  }

  /**
   * Resize a terminal session.
   * 
   * @param sessionId - Session ID to resize
   * @param cols - New column count
   * @param rows - New row count
   * @throws Error if session not found
   */
  public resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    session.ptyProcess.resize(cols, rows);
  }

  /**
   * Close a terminal session.
   * 
   * Kills the PTY process and removes the session from active sessions.
   * 
   * @param sessionId - Session ID to close
   * @throws Error if session not found
   */
  public close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    // Kill PTY process
    session.ptyProcess.kill();

    // Remove from sessions map
    this.sessions.delete(sessionId);
  }

  /**
   * List all active terminal sessions.
   * 
   * @returns Array of terminal session metadata
   */
  public listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).map((session) => session.metadata);
  }

  /**
   * Sanitize environment variables.
   * 
   * Filters environment variables to the child-process allowlist, and only
   * accepts user overrides for allowlisted keys to avoid leaking secrets.
   * 
   * @param userEnv - User-provided environment variables
   * @returns Sanitized environment object
   */
  private sanitizeEnv(userEnv?: Record<string, string>): Record<string, string | undefined> {
    return buildChildProcessEnv({
      userEnv,
      includeElectronRunAsNode: false,
    });
  }

  /**
   * Get default shell for the OS.
   * 
   * @returns Default shell path
   */
  private getDefaultShell(): string {
    const preferredShell = settingsService.getSettings().terminal.defaultShell;

    if (process.platform === 'win32') {
      switch (preferredShell) {
        case 'pwsh':
          return 'pwsh.exe';
        case 'powershell':
          return 'powershell.exe';
        case 'cmd':
          return 'cmd.exe';
        case 'default':
        default:
          return process.env.COMSPEC || 'cmd.exe';
      }
    }

    if (preferredShell === 'pwsh' || preferredShell === 'powershell') {
      return 'pwsh';
    }

    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Clean up all terminal sessions (called on app shutdown).
   */
  public cleanup(): void {
    for (const [sessionId] of this.sessions) {
      try {
        this.close(sessionId);
      } catch {
        // Best effort cleanup - don't throw
      }
    }
    this.sessions.clear();
  }
}

/**
 * Singleton instance of TerminalService for use in IPC handlers.
 */
export const terminalService = TerminalService.getInstance();
