import { BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  TestForceCrashRendererRequestSchema,
  TestForceCrashRendererResponseSchema,
} from 'packages-api-contracts';
import { handleSafe } from './safeIpc';

/**
 * Registers test-only IPC handlers. Guarded by NODE_ENV === 'test'.
 */
export const registerTestOnlyHandlers = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  handleSafe(
    IPC_CHANNELS.TEST_FORCE_CRASH_RENDERER,
    {
      inputSchema: TestForceCrashRendererRequestSchema,
      outputSchema: TestForceCrashRendererResponseSchema,
    },
    (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || window.isDestroyed()) {
        throw new Error('No active window to crash.');
      }
      window.webContents.forcefullyCrashRenderer();
      return { triggered: true };
    }
  );
};
