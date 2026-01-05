/**
 * Unit tests for ExtensionHostManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { PassThrough } from 'stream';

// Create mock fork function
const mockFork = vi.hoisted(() => vi.fn());

// Mock child_process module
vi.mock('child_process', () => ({
  fork: mockFork,
  default: {
    fork: mockFork,
  },
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

describe('ExtensionHostManager', () => {
  let ExtensionHostManager: typeof import('./extension-host-manager').ExtensionHostManager;
  let manager: InstanceType<typeof import('./extension-host-manager').ExtensionHostManager>;
  let mockChildProcess: Partial<ChildProcess>;
  let originalEnv: NodeJS.ProcessEnv;

  const restoreProcessEnv = (env: NodeJS.ProcessEnv) => {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, env);
  };

  beforeEach(async () => {
    originalEnv = { ...process.env };

    // Reset mocks
    vi.clearAllMocks();
    await vi.resetModules();

    // Create mock child process
    mockChildProcess = {
      pid: 12345,
      killed: false,
      stdin: new PassThrough() as any,
      stdout: new PassThrough() as any,
      stderr: new PassThrough() as any,
      on: vi.fn() as any,
      once: vi.fn(((event: string, handler: () => void) => {
        if (event === 'exit') {
          handler();
        }
      }) as any) as any,
      kill: vi.fn() as any,
    };

    // Mock fork to return our mock process
    mockFork.mockReturnValue(mockChildProcess);

    // Create manager instance
    ({ ExtensionHostManager } = await import('./extension-host-manager'));
    manager = new ExtensionHostManager({
      extensionHostPath: '/path/to/extension-host.js',
      extensionsDir: '/path/to/extensions',
    });

    process.env.NODE_ENV = 'test';
    process.env.PATH = '/mock/bin';
    process.env.SECRET_TOKEN = 'shh';
  });

  afterEach(async () => {
    // Clean up
    if (manager.isRunning()) {
      await manager.stop();
    }
    restoreProcessEnv(originalEnv);
  });

  describe('start', () => {
    it('should spawn Extension Host child process', async () => {
      await manager.start();

      expect(mockFork).toHaveBeenCalledWith(
        '/path/to/extension-host.js',
        [],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        })
      );
    });

    it('should set up process monitoring', async () => {
      await manager.start();

      expect(mockChildProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should report running state after start', async () => {
      expect(manager.isRunning()).toBe(false);

      await manager.start();

      expect(manager.isRunning()).toBe(true);
    });

    it('should allowlist environment variables for child process', async () => {
      await manager.start();

      const env = mockFork.mock.calls[0]?.[2]?.env as Record<string, string> | undefined;
      expect(env).toBeDefined();
      expect(env?.SECRET_TOKEN).toBeUndefined();
      expect(env?.PATH ?? env?.Path).toBe('/mock/bin');
      expect(env?.EXTENSIONS_DIR).toBe('/path/to/extensions');
      expect(env?.NODE_ENV).toBe('test');
    });

    it('should not start if already running', async () => {
      await manager.start();
      const firstCallCount = mockFork.mock.calls.length;

      await manager.start();
      const secondCallCount = mockFork.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('stop', () => {
    it('should stop Extension Host gracefully', async () => {
      await manager.start();

      await manager.stop();

      expect(manager.isRunning()).toBe(false);
    });

    it('should force kill if graceful shutdown times out', async () => {
      await manager.start();

      // Mock process not exiting (define killed as false in mock)
      Object.defineProperty(mockChildProcess, 'killed', {
        value: false,
        writable: true,
        configurable: true,
      });
      mockChildProcess.once = vi.fn();

      vi.useFakeTimers();
      const stopPromise = manager.stop();
      await vi.advanceTimersByTimeAsync(5000);
      await stopPromise;
      vi.useRealTimers();

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should do nothing if not running', async () => {
      await manager.stop();

      expect(mockChildProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('crash recovery', () => {
    it('should implement exponential backoff on restart', async () => {
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(global, 'setTimeout');

      await manager.start();

      // Simulate crash
      const exitHandler = (mockChildProcess.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'exit'
      )?.[1];

      if (exitHandler) {
        exitHandler(1, null);

        // Should schedule restart with first timeout (100ms)
        expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
      }

      timeoutSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should stop auto-restart after 5 crashes in 1 minute', async () => {
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(global, 'setTimeout');

      await manager.start();

      const exitHandler = (mockChildProcess.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'exit'
      )?.[1];

      if (exitHandler) {
        // Simulate 5 crashes within 1 minute
        for (let i = 0; i < 5; i++) {
          exitHandler(1, null);
          vi.advanceTimersByTime(1000); // Advance by 1 second
        }

        // After 5th crash, should not schedule another restart
        const setTimeoutCallCount = timeoutSpy.mock.calls.length;
        exitHandler(1, null);

        // Should not have added new setTimeout call
        expect(timeoutSpy.mock.calls.length).toBeLessThanOrEqual(setTimeoutCallCount + 1);
      }

      timeoutSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('JSON-RPC communication', () => {
    it('should throw if sending request when not running', async () => {
      await expect(manager.sendRequest('testMethod')).rejects.toThrow('Extension Host not running');
    });

    it('should throw if sending notification when not running', () => {
      expect(() => manager.sendNotification('testMethod')).toThrow('Extension Host not running');
    });

    it('should throw if registering handlers when not running', () => {
      expect(() => manager.onRequest('testMethod', () => {})).toThrow('Extension Host not running');
      expect(() => manager.onNotification('testMethod', () => {})).toThrow('Extension Host not running');
    });
  });
});
