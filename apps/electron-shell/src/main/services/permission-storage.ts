import fs from 'fs/promises';
import path from 'path';
import { PermissionGrant } from 'packages-api-contracts';

/**
 * Permission registry data structure persisted to disk.
 * P2: No secrets in logs; no plaintext secrets on disk.
 */
export interface PermissionRegistryData {
  /** Schema version for future migrations */
  version: number;
  /** Map of "extensionId:scope" to permission grant */
  grants: Record<string, PermissionGrant>;
}

/**
 * PermissionStorage handles JSON file persistence for permission grants.
 * P1: Runs in main process only.
 * P2: No secrets stored - only permission grants.
 */
export class PermissionStorage {
  private readonly filePath: string;
  private static readonly CURRENT_VERSION = 1;

  /**
   * @param storageDir - Directory to store permissions.json (e.g., userData/extensions)
   */
  constructor(storageDir: string) {
    this.filePath = path.join(storageDir, 'permissions.json');
  }

  /**
   * Load permission grants from disk.
   * Returns empty registry if file doesn't exist.
   * Logs errors and returns empty registry on read/parse failures.
   */
  async load(): Promise<PermissionRegistryData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content) as PermissionRegistryData;
      
      // Basic validation
      if (typeof data.version !== 'number' || typeof data.grants !== 'object') {
        console.error('[PermissionStorage] Invalid registry format, returning empty registry');
        return this.createEmptyRegistry();
      }
      
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet - this is expected on first run
        return this.createEmptyRegistry();
      }
      
      console.error('[PermissionStorage] Failed to load registry:', error);
      return this.createEmptyRegistry();
    }
  }

  /**
   * Save permission grants to disk.
   * Writes atomically using temp file + rename.
   */
  async save(data: PermissionRegistryData): Promise<void> {
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
      console.error('[PermissionStorage] Failed to save registry:', error);
      throw error;
    }
  }

  /**
   * Create empty registry with current schema version.
   */
  private createEmptyRegistry(): PermissionRegistryData {
    return {
      version: PermissionStorage.CURRENT_VERSION,
      grants: {},
    };
  }

  /**
   * Get file path for debugging/testing.
   */
  getFilePath(): string {
    return this.filePath;
  }
}
