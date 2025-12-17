import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, AppInfo } from 'packages-api-contracts';

/**
 * Register all IPC handlers for main process.
 * P6 (Contracts-first): Uses IPC_CHANNELS from api-contracts
 * P1 (Process isolation): Main process owns OS access
 */
export function registerIPCHandlers(): void {
  // Handler for GET_VERSION channel
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async (): Promise<AppInfo> => {
    const info: AppInfo = {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
    return info;
  });
}
