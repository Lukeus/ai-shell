/**
 * ExtensionLoader - Loads extension modules from disk.
 * 
 * P1 (Process Isolation): Runs in Extension Host process only.
 * Extensions are Node.js modules with an exported activate() function.
 */

import { ExtensionManifest } from 'packages-api-contracts';
import * as path from 'path';
import { readFile } from 'fs/promises';
import * as vm from 'vm';

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

const EXTENSION_EVAL_TIMEOUT_MS = 5000;

const buildExtensionConsole = (extensionId: string) => {
  return {
    log: (...args: unknown[]) => console.log(`[Extension ${extensionId}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[Extension ${extensionId}]`, ...args),
    error: (...args: unknown[]) => console.error(`[Extension ${extensionId}]`, ...args),
  };
};

const createSandbox = (extensionId: string): vm.Context => {
  const sandbox: Record<string, unknown> = {
    console: buildExtensionConsole(extensionId),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  sandbox.globalThis = sandbox;

  return vm.createContext(sandbox, {
    codeGeneration: {
      strings: false,
      wasm: false,
    },
  });
};

const createBlockedRequire = (extensionId: string) => {
  return () => {
    throw new Error(`Extension ${extensionId} attempted to use require(), which is not allowed.`);
  };
};

const loadExtensionModule = async (
  manifest: ExtensionManifest,
  extensionPath: string
): Promise<ExtensionModule> => {
  const mainPath = path.join(extensionPath, manifest.main);
  const source = await readFile(mainPath, 'utf-8');

  const wrapperSource = [
    '(function (exports, module, require, __filename, __dirname) {',
    '"use strict";',
    source,
    '\n})',
  ].join('\n');

  const sandbox = createSandbox(manifest.id);
  const script = new vm.Script(wrapperSource, {
    filename: mainPath,
    displayErrors: true,
  });

  const module = { exports: {} as Record<string, unknown> };
  const exports = module.exports;
  const blockedRequire = createBlockedRequire(manifest.id);
  const compiledWrapper = script.runInContext(sandbox, { timeout: EXTENSION_EVAL_TIMEOUT_MS });

  if (typeof compiledWrapper !== 'function') {
    throw new Error(`Extension ${manifest.id} failed to load in sandbox.`);
  }

  compiledWrapper(exports, module, blockedRequire, mainPath, path.dirname(mainPath));

  return module.exports as unknown as ExtensionModule;
};

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
      // Load extension module in VM sandbox (no Node built-ins)
      const module = await loadExtensionModule(manifest, extensionPath);

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
