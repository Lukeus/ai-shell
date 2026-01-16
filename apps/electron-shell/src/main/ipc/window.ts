import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, WindowStateSchema } from 'packages-api-contracts';

const getWindowFromEvent = (event: IpcMainInvokeEvent): BrowserWindow | null => {
  return BrowserWindow.fromWebContents(event.sender) ?? null;
};

export const registerWindowHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event): Promise<void> => {
    const window = getWindowFromEvent(event);
    window?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, async (event): Promise<void> => {
    const window = getWindowFromEvent(event);
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event): Promise<void> => {
    const window = getWindowFromEvent(event);
    window?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, async (event) => {
    const window = getWindowFromEvent(event);
    return WindowStateSchema.parse({
      isMaximized: window?.isMaximized() ?? false,
    });
  });
};
