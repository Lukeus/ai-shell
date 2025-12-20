import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerIPCHandlers } from './ipc-handlers';
import { buildApplicationMenu } from './menu';
import { terminalService } from './services/TerminalService';
import { IPC_CHANNELS } from 'packages-api-contracts';
// SettingsService is initialized lazily when first accessed via IPC handlers

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not available (e.g. in test environment)
}

let mainWindow: BrowserWindow | null = null;

const resolvePreloadPath = (): string => {
  // Try a few known locations produced by @electron-forge/plugin-vite
  const candidates = [
    // Same dir as compiled main (e.g., .vite/build/preload.js)
    path.join(__dirname, 'preload.js'),
    // Subfolder output (e.g., .vite/build/preload/index.js)
    path.join(__dirname, 'preload', 'index.js'),
    // Older patterns
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../preload.js'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // Ignore fs errors, continue to next candidate
    }
  }
  // Fallback to first candidate; Electron will surface a clear error if missing
  return candidates[0];
};

const createWindow = (): void => {
  // Create the browser window with security defaults
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // P2 (Security defaults): contextIsolation ON
      contextIsolation: true,
      // P2 (Security defaults): sandbox ON
      sandbox: true,
      // P2 (Security defaults): nodeIntegration OFF
      nodeIntegration: false,
      // P1 (Process isolation): Preload script path
      preload: resolvePreloadPath(),
    },
  });

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[DEBUG] Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const prodPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('[DEBUG] Loading production file:', prodPath);
    mainWindow.loadFile(prodPath);
  }

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
    // Future: Send to telemetry service
  });

  // Open DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// P1 (Process isolation): Main process handles app lifecycle
app.on('ready', () => {
  // Register IPC handlers before creating window
  registerIPCHandlers();
  
  // Wire up terminal service events to send to renderer
  // P3 (Secrets): Terminal I/O forwarded via IPC, never logged
  terminalService.on('data', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, event);
    }
  });
  
  terminalService.on('exit', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, event);
    }
  });
  
  // Build application menu
  buildApplicationMenu();
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  // Clean up terminal sessions before quitting
  terminalService.cleanup();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
