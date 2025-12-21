import fs from 'fs/promises';
import path from 'path';
import { ExtensionManifestSchema } from 'packages-api-contracts';
import { ExtensionStorage, StoredExtension, ExtensionRegistryData } from './extension-storage';

/**
 * ExtensionRegistry tracks installed extensions and loads manifests from disk.
 * P1: Runs in main process only.
 * P2: Validates all manifests against ExtensionManifestSchema before loading.
 * P3: No secrets stored - only extension metadata.
 */
export class ExtensionRegistry {
  private readonly storage: ExtensionStorage;
  private readonly extensionsDir: string;
  private extensions: Map<string, StoredExtension>;
  private initialized: boolean;

  /**
   * @param extensionsDir - Directory containing extension subdirectories
   */
  constructor(extensionsDir: string) {
    this.extensionsDir = extensionsDir;
    this.storage = new ExtensionStorage(extensionsDir);
    this.extensions = new Map();
    this.initialized = false;
  }

  /**
   * Initialize registry by loading from disk and scanning extensions directory.
   * P2: Validates all manifests against ExtensionManifestSchema.
   * Logs errors for invalid extensions but does not throw.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[ExtensionRegistry] Already initialized');
      return;
    }

    try {
      // Load existing registry from disk
      const data = await this.storage.load();
      
      // Populate in-memory map
      for (const [id, storedExt] of Object.entries(data.extensions)) {
        this.extensions.set(id, storedExt);
      }

      // Scan extensions directory for new/updated extensions
      await this.scanExtensionsDirectory();

      this.initialized = true;
      console.log(`[ExtensionRegistry] Initialized with ${this.extensions.size} extensions`);
    } catch (error) {
      console.error('[ExtensionRegistry] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Scan extensions directory for extension manifests.
   * P2: Validates manifests against ExtensionManifestSchema.
   * Skips invalid extensions with error logging.
   */
  private async scanExtensionsDirectory(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.extensionsDir, { recursive: true });

      // Read directory entries
      const entries = await fs.readdir(this.extensionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const extensionPath = path.join(this.extensionsDir, entry.name);
        await this.loadExtensionManifest(extensionPath);
      }
    } catch (error) {
      console.error('[ExtensionRegistry] Failed to scan extensions directory:', error);
      // Don't throw - allow registry to initialize with existing data
    }
  }

  /**
   * Load and validate extension manifest from directory.
   * P2: Validates against ExtensionManifestSchema before accepting.
   * Logs errors for invalid manifests but does not throw.
   */
  private async loadExtensionManifest(extensionPath: string): Promise<void> {
    try {
      // Read package.json
      const manifestPath = path.join(extensionPath, 'package.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifestJson = JSON.parse(manifestContent);

      // P2: Validate against ExtensionManifestSchema
      const parseResult = ExtensionManifestSchema.safeParse(manifestJson);
      
      if (!parseResult.success) {
        console.error(
          `[ExtensionRegistry] Invalid manifest in ${extensionPath}:`,
          parseResult.error.flatten()
        );
        return;
      }

      const manifest = parseResult.data;
      const now = new Date().toISOString();

      // Check if extension already exists
      const existing = this.extensions.get(manifest.id);
      
      if (existing) {
        // Update if version changed
        if (existing.manifest.version !== manifest.version) {
          const updated: StoredExtension = {
            ...existing,
            manifest,
            extensionPath,
            updatedAt: now,
          };
          this.extensions.set(manifest.id, updated);
          console.log(`[ExtensionRegistry] Updated extension ${manifest.id} to v${manifest.version}`);
          
          // Persist to disk
          await this.persist();
        }
      } else {
        // Add new extension
        const stored: StoredExtension = {
          manifest,
          extensionPath,
          installedAt: now,
          updatedAt: now,
          enabled: true,
        };
        this.extensions.set(manifest.id, stored);
        console.log(`[ExtensionRegistry] Registered new extension ${manifest.id} v${manifest.version}`);
        
        // Persist to disk
        await this.persist();
      }
    } catch (error) {
      // Log error but don't throw - skip this extension
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`[ExtensionRegistry] No package.json found in ${extensionPath}`);
      } else if (error instanceof SyntaxError) {
        console.error(`[ExtensionRegistry] Invalid JSON in ${extensionPath}/package.json`);
      } else {
        console.error(`[ExtensionRegistry] Failed to load manifest from ${extensionPath}:`, error);
      }
    }
  }

  /**
   * Persist current registry state to disk.
   * P3: No secrets stored.
   */
  private async persist(): Promise<void> {
    const data: ExtensionRegistryData = {
      version: 1,
      extensions: Object.fromEntries(this.extensions.entries()),
    };
    await this.storage.save(data);
  }

  /**
   * Get all registered extensions.
   */
  getAllExtensions(): StoredExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get extension by ID.
   */
  getExtension(id: string): StoredExtension | undefined {
    return this.extensions.get(id);
  }

  /**
   * Get all enabled extensions.
   */
  getEnabledExtensions(): StoredExtension[] {
    return Array.from(this.extensions.values()).filter((ext) => ext.enabled);
  }

  /**
   * Enable an extension by ID.
   */
  async enableExtension(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension) {
      return false;
    }

    if (!extension.enabled) {
      extension.enabled = true;
      extension.updatedAt = new Date().toISOString();
      await this.persist();
      console.log(`[ExtensionRegistry] Enabled extension ${id}`);
    }

    return true;
  }

  /**
   * Disable an extension by ID.
   */
  async disableExtension(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension) {
      return false;
    }

    if (extension.enabled) {
      extension.enabled = false;
      extension.updatedAt = new Date().toISOString();
      await this.persist();
      console.log(`[ExtensionRegistry] Disabled extension ${id}`);
    }

    return true;
  }

  /**
   * Uninstall an extension by ID.
   * Removes from registry but does not delete files.
   */
  async uninstallExtension(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension) {
      return false;
    }

    this.extensions.delete(id);
    await this.persist();
    console.log(`[ExtensionRegistry] Uninstalled extension ${id}`);
    return true;
  }

  /**
   * Rescan extensions directory for changes.
   */
  async rescan(): Promise<void> {
    if (!this.initialized) {
      throw new Error('ExtensionRegistry not initialized');
    }

    console.log('[ExtensionRegistry] Rescanning extensions directory');
    await this.scanExtensionsDirectory();
  }

  /**
   * Get storage file path for debugging/testing.
   */
  getStorageFilePath(): string {
    return this.storage.getFilePath();
  }
}
