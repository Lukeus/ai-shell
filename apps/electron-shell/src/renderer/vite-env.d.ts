/// <reference types="vite/client" />

// Import global type augmentation from api-contracts
// This makes window.api available with full type safety
import 'packages-api-contracts';

// Augment window with electron IPC renderer for menu events
// P2 (Security): Only specific whitelisted menu channels are allowed
declare global {
  interface Window {
    electron?: {
      ipcRenderer?: {
        on?: (channel: string, func: (...args: unknown[]) => void) => void;
        removeListener?: (channel: string, func: (...args: unknown[]) => void) => void;
      };
    };
  }
}
