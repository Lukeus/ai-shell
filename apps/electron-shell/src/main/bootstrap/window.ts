import { BrowserWindow, dialog } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from 'packages-api-contracts';
import { attachWindowCrashRecovery } from '../global-errors';
import { resolvePreloadPath } from './paths';

let mainWindow: BrowserWindow | null = null;

type CreateWindowOptions = {
  shouldRecover?: () => boolean;
};

export const getMainWindow = (): BrowserWindow | null => {
  return mainWindow;
};

export const createMainWindow = (options: CreateWindowOptions = {}): BrowserWindow => {
  const useCustomTitleBar = process.platform !== 'darwin';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: useCustomTitleBar,
    frame: !useCustomTitleBar,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: resolvePreloadPath(),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[DEBUG] Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const prodPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('[DEBUG] Loading production file:', prodPath);
    mainWindow.loadFile(prodPath);
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);
  } else {
    mainWindow.setMenuBarVisibility(true);
  }

  const publishWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGED, {
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('maximize', publishWindowState);
  mainWindow.on('unmaximize', publishWindowState);
  mainWindow.on('enter-full-screen', publishWindowState);
  mainWindow.on('leave-full-screen', publishWindowState);

  const shouldRecover = options.shouldRecover ?? (() => true);
  attachWindowCrashRecovery(mainWindow, () => {
    if (shouldRecover()) {
      createMainWindow(options);
    }
  });

  return mainWindow;
};

export const showSafeModeDialog = async (): Promise<void> => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Safe Mode enabled',
    message: 'ai-shell started in Safe Mode.',
    detail: 'Extensions and agents are disabled because a crash loop was detected.',
    buttons: ['OK'],
  });
};
