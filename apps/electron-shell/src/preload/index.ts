import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, PreloadAPI } from 'packages-api-contracts';

/**
 * Preload script that exposes a minimal, secure API to the renderer.
 * P2 (Security defaults): Uses contextBridge to avoid exposing raw Electron APIs.
 * P6 (Contracts-first): Implements PreloadAPI interface from api-contracts.
 */

// Create API object implementing PreloadAPI interface
const api: PreloadAPI = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION),
  
  // Settings management methods
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSettings: (updates) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, updates),
  resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_SETTINGS),
  
  // Workspace management methods
  workspace: {
    open: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN),
    getCurrent: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_CURRENT),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CLOSE),
  },
  
  // File system broker methods (workspace-scoped only)
  fs: {
    readDirectory: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_DIRECTORY, request),
    readFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, request),
    createFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_CREATE_FILE, request),
    createDirectory: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_CREATE_DIRECTORY, request),
    rename: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_RENAME, request),
    delete: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_DELETE, request),
  },
};

// P2 (Security defaults): Expose minimal API via contextBridge
// This ensures the renderer cannot access raw ipcRenderer or Node.js APIs
contextBridge.exposeInMainWorld('api', api);

// Expose limited ipcRenderer for menu events (main -> renderer communication)
// P2: Only expose specific methods needed for menu event handling
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (...args: unknown[]) => void) => {
      // Whitelist allowed channels for menu events
      const validChannels = ['menu:workspace-open', 'menu:workspace-close', 'menu:refresh-explorer'];
      if (validChannels.includes(channel)) {
        // Remove all previous listeners for this channel before adding new one
        ipcRenderer.removeAllListeners(channel);
        ipcRenderer.on(channel, (_, ...args) => func(...args));
      }
    },
    removeListener: (channel: string, func: (...args: unknown[]) => void) => {
      const validChannels = ['menu:workspace-open', 'menu:workspace-close', 'menu:refresh-explorer'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    },
  },
});
