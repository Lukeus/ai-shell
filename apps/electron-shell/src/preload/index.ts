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
};

// P2 (Security defaults): Expose minimal API via contextBridge
// This ensures the renderer cannot access raw ipcRenderer or Node.js APIs
contextBridge.exposeInMainWorld('api', api);
