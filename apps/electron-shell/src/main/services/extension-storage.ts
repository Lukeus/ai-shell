import fs from 'fs/promises';
import path from 'path';
import { ExtensionManifest } from 'packages-api-contracts';

/**
 * Stored extension metadata.
 * P3: No secrets stored in registry - only metadata.
 */
export interface StoredExtension {
  /** Extension manifest data */
  manifest: ExtensionManifest;
  /** Absolute path to extension directory */
  extensionPath: string;
  /** Installation timestamp (ISO 8601) */
  installedAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Whether extension is enabled */
  enabled: boolean;
}

/**
 * Registry data structure persisted to disk.
 */
export interface ExtensionRegistryData {
  /** Schema version for future migrations */
  version: number;
  /** Map of extension ID to stored extension metadata */
  extensions: Record<string, StoredExtension>;
}

/**
 * ExtensionStorage handles JSON file persistence for extension registry.
 * P1: Runs in main process only.
 * P3: No secrets stored - only extension metadata.
 */
export class ExtensionStorage {
  private readonly filePath: string;
  private static readonly CURRENT_VERSION = 1;

  /**
   * @param storageDir - Directory to store extensions.json (e.g., userData/extensions)
   */
  constructor(storageDir: string) {
    this.filePath = path.join(storageDir, 'extensions.json');
  }

  /**
   * Load registry data from disk.
   * Returns empty registry if file doesn't exist.
   * Logs errors and returns empty registry on read/parse failures.
   */
  async load(): Promise<ExtensionRegistryData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content) as ExtensionRegistryData;
      
      // Basic validation
      if (typeof data.version !== 'number' || typeof data.extensions !== 'object') {
        console.error('[ExtensionStorage] Invalid registry format, returning empty registry');
        return this.createEmptyRegistry();
      }
      
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet - this is expected on first run
        return this.createEmptyRegistry();
      }
      
      console.error('[ExtensionStorage] Failed to load registry:', error);
      return this.createEmptyRegistry();
    }
  }

  /**
   * Save registry data to disk.
   * Writes atomically using temp file + rename.
   * Logs errors but does not throw.
   */
  async save(data: ExtensionRegistryData): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write to temp file first for atomic update
      const tempPath = `${this.filePath}.tmp`;
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, content, 'utf-8');
      
      // Atomic rename
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('[ExtensionStorage] Failed to save registry:', error);
      throw error;
    }
  }

  /**
   * Create empty registry with current schema version.
   */
  private createEmptyRegistry(): ExtensionRegistryData {
    return {
      version: ExtensionStorage.CURRENT_VERSION,
      extensions: {},
    };
  }

  /**
   * Get file path for debugging/testing.
   */
  getFilePath(): string {
    return this.filePath;
  }
}
