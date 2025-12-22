import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS, PreloadAPI, WindowStateSchema } from 'packages-api-contracts';

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
    writeFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, request),
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

  // Search methods (workspace)
  search: {
    query: (request) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_QUERY, request),
    replace: (request) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_REPLACE, request),
  },

  // Source control methods (Git)
  scm: {
    status: (request) => ipcRenderer.invoke(IPC_CHANNELS.SCM_STATUS, request),
    stage: (request) => ipcRenderer.invoke(IPC_CHANNELS.SCM_STAGE, request),
    unstage: (request) => ipcRenderer.invoke(IPC_CHANNELS.SCM_UNSTAGE, request),
    commit: (request) => ipcRenderer.invoke(IPC_CHANNELS.SCM_COMMIT, request),
  },

  // Agent runs + events (read-only stream + controls)
  agents: {
    listRuns: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUNS_LIST),
    getRun: (request) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUNS_GET, request),
    startRun: (request) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUNS_START, request),
    cancelRun: (request) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUNS_CANCEL, request),
    retryRun: (request) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUNS_RETRY, request),
    listTrace: (request) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_TRACE_LIST, request),
    subscribeEvents: (request) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_EVENTS_SUBSCRIBE, request),
    unsubscribeEvents: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_EVENTS_UNSUBSCRIBE, request),
    onEvent: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENTS_ON_EVENT, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENTS_ON_EVENT, listener);
      };
    },
  },

  // Connections + secrets methods (metadata only)
  connections: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_LIST),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_CREATE, request),
    update: (request) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_UPDATE, request),
    delete: (request) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_DELETE, request),
    setSecret: (request) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_SET_SECRET, request),
    replaceSecret: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_REPLACE_SECRET, request),
    requestSecretAccess: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_REQUEST_SECRET_ACCESS, request),
  },

  // Audit methods (read-only)
  audit: {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTIONS_AUDIT_LIST, request),
  },

  // Extensions methods
  // P1 (Process isolation): Renderer never talks directly to Extension Host
  // All extension operations go through main process
  extensions: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST),
    get: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_GET, request),
    enable: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_ENABLE, request),
    disable: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_DISABLE, request),
    uninstall: (request) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_UNINSTALL, request),
    executeCommand: (command, args) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND, command, args),
    listCommands: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST_COMMANDS),
    listViews: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST_VIEWS),
    requestPermission: (extensionId, scope) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_REQUEST_PERMISSION, extensionId, scope),
    listPermissions: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST_PERMISSIONS, request),
    revokePermissions: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_REVOKE_PERMISSION, request),

    // P2 (Security defaults): Event subscription with proper cleanup
    onStateChange: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.EXTENSIONS_ON_STATE_CHANGE, listener);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EXTENSIONS_ON_STATE_CHANGE, listener);
      };
    },
  },

  windowControls: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    getState: async () => {
      const state = await ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_STATE);
      return WindowStateSchema.parse(state);
    },
    onStateChange: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (_event: IpcRendererEvent, data: any) => {
        const state = WindowStateSchema.parse(data);
        callback(state);
      };
      ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      };
    },
  },
};

// P2 (Security defaults): Expose minimal API via contextBridge
// This ensures the renderer cannot access raw ipcRenderer or Node.js APIs
contextBridge.exposeInMainWorld('api', api);

const menuIpcHandlers = new Map<
  string,
  Map<(...args: unknown[]) => void, (...args: unknown[]) => void>
>();

// Expose limited ipcRenderer for menu events (main -> renderer communication)
// P2: Only expose specific methods needed for menu event handling
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (...args: unknown[]) => void) => {
      // Whitelist allowed channels for menu events
      const validChannels = new Set<string>([
        IPC_CHANNELS.MENU_WORKSPACE_OPEN,
        IPC_CHANNELS.MENU_WORKSPACE_CLOSE,
        IPC_CHANNELS.MENU_REFRESH_EXPLORER,
        IPC_CHANNELS.MENU_TOGGLE_SECONDARY_SIDEBAR,
      ]);
      if (validChannels.has(channel)) {
        const channelHandlers = menuIpcHandlers.get(channel) ?? new Map();
        const existing = channelHandlers.get(func);
        if (existing) {
          ipcRenderer.removeListener(channel, existing);
        }
        const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
        channelHandlers.set(func, wrapped);
        menuIpcHandlers.set(channel, channelHandlers);
        ipcRenderer.on(channel, wrapped);
        return () => {
          const currentHandlers = menuIpcHandlers.get(channel);
          const current = currentHandlers?.get(func);
          if (current) {
            ipcRenderer.removeListener(channel, current);
            currentHandlers?.delete(func);
            if (currentHandlers?.size === 0) {
              menuIpcHandlers.delete(channel);
            }
          }
        };
      }
      return () => {};
    },
    removeListener: (channel: string, func: (...args: unknown[]) => void) => {
      const validChannels = new Set<string>([
        IPC_CHANNELS.MENU_WORKSPACE_OPEN,
        IPC_CHANNELS.MENU_WORKSPACE_CLOSE,
        IPC_CHANNELS.MENU_REFRESH_EXPLORER,
        IPC_CHANNELS.MENU_TOGGLE_SECONDARY_SIDEBAR,
      ]);
      if (validChannels.has(channel)) {
        const channelHandlers = menuIpcHandlers.get(channel);
        const wrapped = channelHandlers?.get(func);
        if (wrapped) {
          ipcRenderer.removeListener(channel, wrapped);
          channelHandlers?.delete(func);
          if (channelHandlers?.size === 0) {
            menuIpcHandlers.delete(channel);
          }
          return;
        }
        ipcRenderer.removeListener(channel, func);
      }
    },
  },
});
