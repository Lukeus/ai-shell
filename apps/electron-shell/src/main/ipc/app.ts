import { app, ipcMain } from 'electron';
import { IPC_CHANNELS, type AppInfo } from 'packages-api-contracts';

export const registerAppHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async (): Promise<AppInfo> => {
    return {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
  });
};
