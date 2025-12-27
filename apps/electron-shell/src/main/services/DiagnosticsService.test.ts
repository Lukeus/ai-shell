import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const electronState = vi.hoisted(() => ({ userDataPath: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => electronState.userDataPath),
  },
}));

import { DiagnosticsService, DIAGNOSTICS_LIMITS } from './DiagnosticsService';

describe('DiagnosticsService', () => {
  beforeEach(() => {
    electronState.userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'));
    // @ts-expect-error reset singleton for tests
    DiagnosticsService.instance = null;
  });

  afterEach(() => {
    if (electronState.userDataPath) {
      fs.rmSync(electronState.userDataPath, { recursive: true, force: true });
    }
    electronState.userDataPath = '';
    vi.clearAllMocks();
  });

  it('sanitizes sensitive context keys and truncates fields', async () => {
    const service = DiagnosticsService.getInstance();
    const longMessage = 'a'.repeat(DIAGNOSTICS_LIMITS.message + 10);
    const longStack = 'b'.repeat(DIAGNOSTICS_LIMITS.stack + 10);

    const ok = await service.reportError({
      source: 'renderer',
      message: longMessage,
      name: 'ExampleError',
      stack: longStack,
      timestamp: new Date().toISOString(),
      context: {
        token: 'secret',
        env: 'API_KEY=123',
        safeKey: 'ok',
      },
    });

    expect(ok).toBe(true);

    const logPath = await service.getLogPath();
    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
    const entry = JSON.parse(lines[0] ?? '{}') as {
      message: string;
      stack?: string;
      context?: Record<string, string>;
    };

    expect(entry.message.length).toBeLessThanOrEqual(DIAGNOSTICS_LIMITS.message);
    expect((entry.stack ?? '').length).toBeLessThanOrEqual(DIAGNOSTICS_LIMITS.stack);
    expect(entry.context?.token).toBeUndefined();
    expect(entry.context?.env).toBeUndefined();
    expect(entry.context?.safeKey).toBe('ok');
  });

  it('rotates the log file when size exceeds limit', async () => {
    const service = DiagnosticsService.getInstance();
    const logPath = await service.getLogPath();
    const logDir = path.dirname(logPath);
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(logPath, 'x'.repeat(DIAGNOSTICS_LIMITS.maxLogBytes + 5));

    await service.reportError({
      source: 'main',
      message: 'Rotated',
      timestamp: new Date().toISOString(),
    });

    const rotatedPath = path.join(logDir, 'ai-shell.log.1');
    expect(fs.existsSync(rotatedPath)).toBe(true);
  });
});
