import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
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
  
  // Terminal management methods (PTY sessions)
  // P1 (Process isolation): All PTY operations via main process
  // P3 (Secrets): Terminal I/O never logged
  terminal: {
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, request),
    write: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, request),
    resize: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, request),
    close: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CLOSE, request),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_LIST),
    
    // P2 (Security defaults): Event subscriptions with proper cleanup
    onData: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, listener);
      };
    },
    
    onExit: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, listener);
      };
    },
  },
  
  // Output channel methods
  output: {
    append: (request) => ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_APPEND, request),
    clear: (request) => ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_CLEAR, request),
    listChannels: () => ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_LIST_CHANNELS),
    read: (request) => ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_READ, request),
    
    // P2 (Security defaults): Event subscriptions with proper cleanup
    onAppend: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.OUTPUT_ON_APPEND, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.OUTPUT_ON_APPEND, listener);
      };
    },
    
    onClear: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.OUTPUT_ON_CLEAR, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.OUTPUT_ON_CLEAR, listener);
      };
    },
  },
  
  // Diagnostics methods (problems panel)
  diagnostics: {
    publish: (request) => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_PUBLISH, request),
    clear: (request) => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_CLEAR, request),
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_LIST, request),
    
    // P2 (Security defaults): Event subscriptions with proper cleanup
    onUpdate: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.DIAGNOSTICS_ON_UPDATE, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.DIAGNOSTICS_ON_UPDATE, listener);
      };
    },
    
    onSummary: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.DIAGNOSTICS_ON_SUMMARY, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.DIAGNOSTICS_ON_SUMMARY, listener);
      };
    },
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
