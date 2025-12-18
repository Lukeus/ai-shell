import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  Settings,
  SettingsSchema,
  SETTINGS_DEFAULTS,
  type PartialSettings,
} from 'packages-api-contracts';

/**
 * SettingsService - Singleton service for managing application settings persistence.
 * 
 * This service owns all settings file I/O operations and ensures settings are validated
 * with Zod before being persisted. Settings are stored in the userData directory as
 * settings.json with pretty-printed formatting for manual editing.
 * 
 * Security: This service runs ONLY in the main process. The renderer accesses settings
 * exclusively via IPC (window.api.*), maintaining process isolation (P1).
 * 
 * @remarks
 * - Storage: app.getPath('userData')/settings.json
 * - Format: Pretty-printed JSON (2-space indent)
 * - Validation: All reads/writes validated with SettingsSchema (Zod)
 * - Error handling: Corrupted files fall back to defaults, never block app launch
 * - No secrets: Settings contain only UI preferences (P3)
 */
export class SettingsService {
  private static instance: SettingsService | null = null;
  private readonly settingsPath: string;
  private cachedSettings: Settings | null = null;

  /**
   * Private constructor enforces singleton pattern.
   * 
   * @remarks
   * Use SettingsService.getInstance() to access the service.
   */
  private constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
  }

  /**
   * Get the singleton instance of SettingsService.
   * 
   * @returns The singleton SettingsService instance
   */
  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Get all application settings.
   * 
   * Reads settings from disk, validates with Zod, and returns the complete Settings
   * object. If the file is corrupted or doesn't exist, falls back to SETTINGS_DEFAULTS
   * and overwrites the file.
   * 
   * @returns Complete Settings object
   * @throws Error if settings cannot be recovered (extremely rare)
   * 
   * @example
   * ```typescript
   * const settings = settingsService.getSettings();
   * console.log(settings.appearance.theme); // 'dark'
   * ```
   */
  public getSettings(): Settings {
    // Return cached settings if available
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      // Read settings file
      const fileContent = fs.readFileSync(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(fileContent);

      // Validate with Zod
      const validated = SettingsSchema.parse(parsed);
      this.cachedSettings = validated;
      return validated;
    } catch (error) {
      // Corrupted or missing file: log warning, use defaults, overwrite file
      console.warn(
        'Settings file corrupted or missing, using defaults:',
        error instanceof Error ? error.message : String(error)
      );

      // Write defaults to disk (best effort, don't throw)
      try {
        this.saveSettingsToDisk(SETTINGS_DEFAULTS);
      } catch (writeError) {
        console.error(
          'Failed to write default settings to disk:',
          writeError instanceof Error ? writeError.message : String(writeError)
        );
      }

      this.cachedSettings = SETTINGS_DEFAULTS;
      return SETTINGS_DEFAULTS;
    }
  }

  /**
   * Update application settings (partial merge).
   * 
   * Merges the provided updates with existing settings, validates the result with Zod,
   * and persists to disk. Only the provided fields are updated; unspecified fields
   * retain their current values.
   * 
   * @param updates - Partial settings object with fields to update
   * @returns Updated complete Settings object
   * @throws Error if validation fails or disk write fails after retry
   * 
   * @example
   * ```typescript
   * // Only update theme, leave other settings unchanged
   * const updated = settingsService.updateSettings({
   *   appearance: { theme: 'light' }
   * });
   * ```
   */
  public updateSettings(updates: PartialSettings): Settings {
    // Get current settings
    const current = this.getSettings();

    // Deep merge updates with current settings
    const merged = this.deepMerge(current, updates);

    // Validate merged settings with Zod
    const validated = SettingsSchema.parse(merged);

    // Persist to disk
    this.saveSettingsToDisk(validated);

    // Update cache
    this.cachedSettings = validated;

    return validated;
  }

  /**
   * Reset all settings to defaults.
   * 
   * Overwrites the settings file with SETTINGS_DEFAULTS and clears the cache.
   * 
   * @returns Default Settings object
   * @throws Error if disk write fails after retry
   * 
   * @example
   * ```typescript
   * const defaults = settingsService.resetSettings();
   * console.log(defaults.appearance.theme); // 'dark'
   * ```
   */
  public resetSettings(): Settings {
    // Write defaults to disk
    this.saveSettingsToDisk(SETTINGS_DEFAULTS);

    // Clear cache
    this.cachedSettings = SETTINGS_DEFAULTS;

    return SETTINGS_DEFAULTS;
  }

  /**
   * Save settings to disk with retry logic.
   * 
   * Writes settings to settings.json with pretty-printing (2-space indent).
   * If the write fails, retries once after 100ms. Throws if both attempts fail.
   * 
   * @param settings - Settings object to persist
   * @throws Error if write fails after retry
   * 
   * @remarks
   * This is a private method used by updateSettings() and resetSettings().
   * Write failures are rare (disk full, permissions issue).
   */
  private saveSettingsToDisk(settings: Settings): void {
    const json = JSON.stringify(settings, null, 2);

    try {
      // Ensure directory exists
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to disk
      fs.writeFileSync(this.settingsPath, json, 'utf-8');
    } catch (error) {
      // Write failed, retry once after 100ms
      console.error(
        'Settings write failed, retrying...',
        error instanceof Error ? error.message : String(error)
      );

      // Wait 100ms
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait (main process, acceptable for 100ms)
      }

      try {
        // Retry write
        fs.writeFileSync(this.settingsPath, json, 'utf-8');
      } catch (retryError) {
        // Both attempts failed, throw error
        console.error(
          'Settings write retry failed:',
          retryError instanceof Error ? retryError.message : String(retryError)
        );
        throw new Error(
          `Failed to persist settings to disk: ${
            retryError instanceof Error ? retryError.message : String(retryError)
          }`
        );
      }
    }
  }

  /**
   * Deep merge two objects.
   * 
   * Recursively merges source into target. Arrays are replaced, not merged.
   * Used for merging partial settings updates with existing settings.
   * 
   * @param target - Target object (existing settings)
   * @param source - Source object (updates)
   * @returns Merged object
   * 
   * @remarks
   * This is a private utility method for updateSettings().
   */
  private deepMerge(target: any, source: any): any {
    // If source is not an object, return it directly
    if (typeof source !== 'object' || source === null) {
      return source;
    }

    // If target is not an object, replace with source
    if (typeof target !== 'object' || target === null) {
      return source;
    }

    // Clone target to avoid mutation
    const result = { ...target };

    // Merge each key from source
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        // If both are objects (and not arrays), recurse
        if (
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(sourceValue) &&
          typeof targetValue === 'object' &&
          targetValue !== null &&
          !Array.isArray(targetValue)
        ) {
          result[key] = this.deepMerge(targetValue, sourceValue);
        } else {
          // Otherwise, replace target value with source value
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }
}

/**
 * Singleton instance accessor for convenience.
 * 
 * @example
 * ```typescript
 * import { settingsService } from './services/SettingsService';
 * const settings = settingsService.getSettings();
 * ```
 */
export const settingsService = SettingsService.getInstance();
