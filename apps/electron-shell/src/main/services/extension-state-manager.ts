/**
 * ExtensionStateManager - Tracks extension states and broadcasts changes to renderer.
 * 
 * Task 9: All extensions marked inactive after crash.
 * Task 9: Renderer notified of state changes via IPC events.
 */

import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from 'packages-api-contracts';

/**
 * Extension state enum.
 */
export type ExtensionState = 'inactive' | 'activating' | 'active' | 'failed' | 'disabled';

/**
 * Extension state change event.
 */
export interface ExtensionStateChangeEvent {
  extensionId: string;
  state: ExtensionState;
  previousState?: ExtensionState;
  timestamp: string;
  reason?: string;
}

/**
 * Manages extension states and broadcasts changes to renderer process.
 */
export class ExtensionStateManager {
  private states: Map<string, ExtensionState>;

  constructor() {
    this.states = new Map();
  }

  /**
   * Gets the current state of an extension.
   */
  public getState(extensionId: string): ExtensionState {
    return this.states.get(extensionId) || 'inactive';
  }

  /**
   * Sets the state of an extension and broadcasts the change.
   */
  public setState(extensionId: string, state: ExtensionState, reason?: string): void {
    const previousState = this.states.get(extensionId);
    
    // Only broadcast if state actually changed
    if (previousState === state) {
      return;
    }

    this.states.set(extensionId, state);

    // Broadcast state change to renderer
    this.broadcastStateChange({
      extensionId,
      state,
      previousState,
      timestamp: new Date().toISOString(),
      reason,
    });

    console.log(`[ExtensionStateManager] Extension ${extensionId} state: ${previousState || 'none'} → ${state}${reason ? ` (${reason})` : ''}`);
  }

  /**
   * Marks all extensions as inactive.
   * Task 9 invariant: All extensions marked inactive after crash.
   */
  public markAllInactive(reason?: string): void {
    const extensionIds = Array.from(this.states.keys());
    
    for (const extensionId of extensionIds) {
      const currentState = this.states.get(extensionId);
      
      // Only update if not already inactive
      if (currentState !== 'inactive' && currentState !== 'disabled') {
        this.setState(extensionId, 'inactive', reason || 'Extension Host crashed');
      }
    }

    console.log(`[ExtensionStateManager] Marked ${extensionIds.length} extensions as inactive`);
  }

  /**
   * Gets all extension states.
   */
  public getAllStates(): Map<string, ExtensionState> {
    return new Map(this.states);
  }

  /**
   * Clears all extension states.
   */
  public clear(): void {
    this.states.clear();
  }

  /**
   * Broadcasts a state change event to all renderer windows.
   * Task 9 invariant: Renderer notified of state changes via IPC events.
   */
  private broadcastStateChange(event: ExtensionStateChangeEvent): void {
    const windows = BrowserWindow.getAllWindows();
    
    for (const window of windows) {
      if (window.isDestroyed()) {
        continue;
      }

      try {
        window.webContents.send(IPC_CHANNELS.EXTENSIONS_ON_STATE_CHANGE, event);
      } catch (error) {
        console.error('[ExtensionStateManager] Failed to broadcast state change:', error);
      }
    }
  }
}
