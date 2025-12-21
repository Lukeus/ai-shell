/**
 * ActivationController - Manages lazy activation of extensions based on events.
 * 
 * P5 (Performance Budgets): Extensions activate lazily only when activation event fires.
 * State transitions: inactive → activating → active/failed
 */

import { ExtensionManifest, ExtensionContext, ExtensionState } from 'packages-api-contracts';
import { ExtensionLoader, LoadedExtension } from './extension-loader';

/**
 * Activation timeout in milliseconds (30 seconds).
 */
const ACTIVATION_TIMEOUT_MS = 30000;

/**
 * Active extension metadata.
 */
interface ActiveExtension {
  manifest: ExtensionManifest;
  extensionPath: string;
  state: ExtensionState;
  activatedAt?: number;
  error?: string;
}

/**
 * ActivationController manages extension lifecycle and lazy activation.
 */
export class ActivationController {
  private loader: ExtensionLoader;
  private activeExtensions = new Map<string, ActiveExtension>();
  private activationPromises = new Map<string, Promise<void>>();

  constructor(loader: ExtensionLoader) {
    this.loader = loader;
  }

  /**
   * Register an extension for potential activation.
   * Does not activate the extension - it remains inactive until an activation event fires.
   */
  registerExtension(manifest: ExtensionManifest, extensionPath: string): void {
    if (this.activeExtensions.has(manifest.id)) {
      console.warn(`[ActivationController] Extension ${manifest.id} already registered`);
      return;
    }

    this.activeExtensions.set(manifest.id, {
      manifest,
      extensionPath,
      state: 'inactive',
    });

    console.log(`[ActivationController] Registered extension ${manifest.id} with activation events: ${manifest.activationEvents.join(', ')}`);
  }

  /**
   * Activate an extension by ID.
   * P5: Lazy activation only when called.
   * State transition: inactive → activating → active/failed
   * 
   * @param extensionId - Extension ID to activate
   * @param context - Extension context to pass to activate()
   */
  async activateExtension(extensionId: string, context: ExtensionContext): Promise<void> {
    const ext = this.activeExtensions.get(extensionId);
    if (!ext) {
      throw new Error(`Extension ${extensionId} not registered`);
    }

    // If already active, return immediately
    if (ext.state === 'active') {
      return;
    }

    // If currently activating, wait for that promise
    if (ext.state === 'activating') {
      const existingPromise = this.activationPromises.get(extensionId);
      if (existingPromise) {
        return existingPromise;
      }
    }

    // If failed, allow re-activation attempt
    if (ext.state === 'failed') {
      ext.error = undefined;
    }

    // Update state to activating
    ext.state = 'activating';
    this.notifyStateChange(extensionId, 'activating');

    // Create activation promise
    const activationPromise = this.performActivation(ext, context);
    this.activationPromises.set(extensionId, activationPromise);

    try {
      await activationPromise;
    } finally {
      this.activationPromises.delete(extensionId);
    }
  }

  /**
   * Perform the actual activation with timeout handling.
   */
  private async performActivation(ext: ActiveExtension, context: ExtensionContext): Promise<void> {
    const extensionId = ext.manifest.id;

    try {
      // Load extension module if not already loaded
      const loaded = await this.loader.loadExtension(ext.manifest, ext.extensionPath);

      // Call activate() with timeout
      await this.activateWithTimeout(loaded, context);

      // Update state to active
      ext.state = 'active';
      ext.activatedAt = Date.now();
      this.notifyStateChange(extensionId, 'active');

      console.log(`[ActivationController] Extension ${extensionId} activated successfully`);
    } catch (error) {
      // Update state to failed
      const errorMessage = (error as Error).message;
      ext.state = 'failed';
      ext.error = errorMessage;
      this.notifyStateChange(extensionId, 'failed', errorMessage);

      console.error(`[ActivationController] Extension ${extensionId} activation failed:`, error);
      throw error;
    }
  }

  /**
   * Call extension's activate() function with timeout.
   */
  private async activateWithTimeout(loaded: LoadedExtension, context: ExtensionContext): Promise<void> {
    return Promise.race([
      // Call activate()
      Promise.resolve(loaded.module.activate(context)),
      // Timeout after 30 seconds
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Extension activation timeout (${ACTIVATION_TIMEOUT_MS}ms)`));
        }, ACTIVATION_TIMEOUT_MS);
      }),
    ]);
  }

  /**
   * Deactivate an extension by ID.
   * State transition: active/failed → deactivating → inactive
   */
  async deactivateExtension(extensionId: string): Promise<void> {
    const ext = this.activeExtensions.get(extensionId);
    if (!ext) {
      throw new Error(`Extension ${extensionId} not registered`);
    }

    if (ext.state === 'inactive' || ext.state === 'deactivating') {
      return;
    }

    ext.state = 'deactivating';
    this.notifyStateChange(extensionId, 'deactivating');

    try {
      const loaded = this.loader.getLoadedExtension(extensionId);
      if (loaded && loaded.module.deactivate) {
        await loaded.module.deactivate();
      }

      ext.state = 'inactive';
      ext.activatedAt = undefined;
      ext.error = undefined;
      this.notifyStateChange(extensionId, 'inactive');

      console.log(`[ActivationController] Extension ${extensionId} deactivated`);
    } catch (error) {
      console.error(`[ActivationController] Error deactivating extension ${extensionId}:`, error);
      // Still mark as inactive even if deactivate() failed
      ext.state = 'inactive';
      this.notifyStateChange(extensionId, 'inactive');
    }
  }

  /**
   * Check if an extension should activate for a given activation event.
   * 
   * @param extensionId - Extension ID
   * @param event - Activation event (e.g., "onCommand:myCommand", "onStartup")
   */
  shouldActivate(extensionId: string, event: string): boolean {
    const ext = this.activeExtensions.get(extensionId);
    if (!ext || ext.state !== 'inactive') {
      return false;
    }

    // Check if extension declares this activation event
    return ext.manifest.activationEvents.some((activationEvent) => {
      // Exact match
      if (activationEvent === event) {
        return true;
      }

      // Wildcard match (e.g., "onCommand" matches "onCommand:*")
      if (event.startsWith(activationEvent + ':')) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get all extension IDs that should activate for a given event.
   */
  getExtensionsToActivate(event: string): string[] {
    const result: string[] = [];

    for (const [extensionId, ext] of this.activeExtensions.entries()) {
      if (ext.state === 'inactive' && this.shouldActivate(extensionId, event)) {
        result.push(extensionId);
      }
    }

    return result;
  }

  /**
   * Get extension state.
   */
  getExtensionState(extensionId: string): ExtensionState | undefined {
    return this.activeExtensions.get(extensionId)?.state;
  }

  /**
   * Get all active extensions (state === 'active').
   */
  getActiveExtensions(): string[] {
    const result: string[] = [];
    for (const [id, ext] of this.activeExtensions.entries()) {
      if (ext.state === 'active') {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Mark all extensions as inactive (e.g., after Extension Host crash).
   */
  markAllInactive(): void {
    for (const ext of this.activeExtensions.values()) {
      if (ext.state !== 'inactive') {
        ext.state = 'inactive';
        ext.activatedAt = undefined;
        ext.error = undefined;
        this.notifyStateChange(ext.manifest.id, 'inactive');
      }
    }
    console.log('[ActivationController] Marked all extensions as inactive');
  }

  /**
   * Notify about state change (stub for now - will be connected to JSON-RPC later).
   */
  private notifyStateChange(extensionId: string, state: ExtensionState, error?: string): void {
    // This will be connected to JSON-RPC notification in index.ts
    console.log(`[ActivationController] State change: ${extensionId} → ${state}${error ? ` (${error})` : ''}`);
  }
}
