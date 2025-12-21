/**
 * ExtensionLoader - Loads extension modules from disk.
 * 
 * P1 (Process Isolation): Runs in Extension Host process only.
 * Extensions are Node.js modules with an exported activate() function.
 */

import { ExtensionManifest, ExtensionContext } from 'packages-api-contracts';
import * as path from 'path';

/**
 * Extension module interface.
 * Extensions must export an activate function and optionally a deactivate function.
 */
export interface ExtensionModule {
  activate(context: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/**
 * Loaded extension metadata.
 */
export interface LoadedExtension {
  manifest: ExtensionManifest;
  extensionPath: string;
  module: ExtensionModule;
}

/**
 * ExtensionLoader handles loading extension modules from disk.
 */
export class ExtensionLoader {
  private loadedExtensions = new Map<string, LoadedExtension>();

  /**
   * Load an extension module from disk.
   * 
   * @param manifest - Extension manifest
   * @param extensionPath - Absolute path to extension directory
   * @returns Loaded extension metadata
   */
  async loadExtension(manifest: ExtensionManifest, extensionPath: string): Promise<LoadedExtension> {
    // Check if already loaded
    if (this.loadedExtensions.has(manifest.id)) {
      return this.loadedExtensions.get(manifest.id)!;
    }

    try {
      // Resolve main entry point
      const mainPath = path.join(extensionPath, manifest.main);
      
      // Dynamically import the extension module
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require(mainPath) as ExtensionModule;

      // Validate module has activate function
      if (typeof module.activate !== 'function') {
        throw new Error(`Extension ${manifest.id} does not export an activate() function`);
      }

      const loaded: LoadedExtension = {
        manifest,
        extensionPath,
        module,
      };

      this.loadedExtensions.set(manifest.id, loaded);
      console.log(`[ExtensionLoader] Loaded extension ${manifest.id} from ${extensionPath}`);

      return loaded;
    } catch (error) {
      console.error(`[ExtensionLoader] Failed to load extension ${manifest.id}:`, error);
      throw new Error(`Failed to load extension ${manifest.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Get a loaded extension by ID.
   */
  getLoadedExtension(extensionId: string): LoadedExtension | undefined {
    return this.loadedExtensions.get(extensionId);
  }

  /**
   * Check if an extension is loaded.
   */
  isLoaded(extensionId: string): boolean {
    return this.loadedExtensions.has(extensionId);
  }

  /**
   * Unload an extension (remove from cache).
   * Note: Node.js modules cannot be truly unloaded once required.
   */
  unloadExtension(extensionId: string): void {
    this.loadedExtensions.delete(extensionId);
    console.log(`[ExtensionLoader] Unloaded extension ${extensionId} from cache`);
  }

  /**
   * Get all loaded extension IDs.
   */
  getLoadedExtensionIds(): string[] {
    return Array.from(this.loadedExtensions.keys());
  }
}
