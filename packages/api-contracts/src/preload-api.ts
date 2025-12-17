import type { AppInfo } from './types/app-info';

/**
 * Preload API surface exposed to the renderer process via contextBridge.
 * This defines the contract for communication between renderer and main process.
 * 
 * Security: This is the ONLY API the sandboxed renderer can access.
 * All methods must be carefully reviewed to prevent privilege escalation.
 */
export interface PreloadAPI {
  /**
   * Retrieves version information about the application and runtime.
   * @returns Promise resolving to AppInfo object with version details
   */
  getVersion(): Promise<AppInfo>;
  
  // Future expansion:
  // invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * Global type augmentation for the renderer process.
 * Makes window.api available with full type safety in renderer code.
 */
declare global {
  interface Window {
    api: PreloadAPI;
  }
}
