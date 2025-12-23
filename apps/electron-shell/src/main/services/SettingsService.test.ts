import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsService } from './SettingsService';
import { SETTINGS_DEFAULTS } from 'packages-api-contracts';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('SettingsService', () => {
  let settingsService: SettingsService;
  const mockUserDataPath = 'C:\\mock\\userdata';
  const mockSettingsPath = path.join(mockUserDataPath, 'settings.json');

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset the singleton instance using reflection
    // @ts-expect-error Accessing private static field for testing
    SettingsService.instance = null;
    
    // Get fresh instance
    settingsService = SettingsService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSettings()', () => {
    it('should read file, parse JSON, and validate with Zod', () => {
      // Arrange
      const mockSettings = {
        appearance: { theme: 'light', fontSize: 16, iconTheme: 'default', menuBarVisible: true },
        editor: { wordWrap: false, lineNumbers: true, minimap: false, breadcrumbsEnabled: true },
        terminal: { defaultShell: 'pwsh' },
        extensions: { autoUpdate: true, enableTelemetry: true },
        agents: { defaultConnectionId: null },
        sdd: { enabled: true, blockCommitOnUntrackedCodeChanges: false },
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSettings));

      // Act
      const result = settingsService.getSettings();

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith(mockSettingsPath, 'utf-8');
      expect(result).toEqual(mockSettings);
      expect(result.appearance.theme).toBe('light');
      expect(result.appearance.fontSize).toBe(16);
    });

    it('should return cached settings on subsequent calls', () => {
      // Arrange
      const mockSettings = SETTINGS_DEFAULTS;
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSettings));

      // Act
      const first = settingsService.getSettings();
      const second = settingsService.getSettings();

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Only called once
      expect(first).toBe(second); // Same object reference (cached)
    });

    it('should fall back to SETTINGS_DEFAULTS when file is corrupted', () => {
      // Arrange
      vi.mocked(fs.readFileSync).mockReturnValue('{invalid json}');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Act
      const result = settingsService.getSettings();

      // Assert
      expect(result).toEqual(SETTINGS_DEFAULTS);
      // Verify it attempted to overwrite with defaults
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSettingsPath,
        JSON.stringify(SETTINGS_DEFAULTS, null, 2),
        'utf-8'
      );
    });

    it('should fall back to SETTINGS_DEFAULTS when file does not exist', () => {
      // Arrange
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Act
      const result = settingsService.getSettings();

      // Assert
      expect(result).toEqual(SETTINGS_DEFAULTS);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should fall back to SETTINGS_DEFAULTS when Zod validation fails', () => {
      // Arrange - missing required fields
      const invalidSettings = {
        appearance: { theme: 'dark' }, // Missing fontSize and iconTheme
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidSettings));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Act
      const result = settingsService.getSettings();

      // Assert
      expect(result).toEqual(SETTINGS_DEFAULTS);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('updateSettings()', () => {
    beforeEach(() => {
      // Setup: Start with default settings
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SETTINGS_DEFAULTS));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    });

    it('should merge partial updates, validate, persist, and return updated Settings', () => {
      // Arrange
      const updates = {
        appearance: { theme: 'light' as const },
      };

      // Act
      const result = settingsService.updateSettings(updates);

      // Assert
      expect(result.appearance.theme).toBe('light');
      // Other fields should remain unchanged
      expect(result.appearance.fontSize).toBe(SETTINGS_DEFAULTS.appearance.fontSize);
      expect(result.editor).toEqual(SETTINGS_DEFAULTS.editor);
      expect(result.terminal).toEqual(SETTINGS_DEFAULTS.terminal);
      expect(result.extensions).toEqual(SETTINGS_DEFAULTS.extensions);
      expect(result.agents).toEqual(SETTINGS_DEFAULTS.agents);
      expect(result.sdd).toEqual(SETTINGS_DEFAULTS.sdd);

      // Verify persistence
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSettingsPath,
        expect.stringContaining('"theme": "light"'),
        'utf-8'
      );
    });

    it('should deep merge nested updates', () => {
      // Arrange
      const updates = {
        appearance: { fontSize: 18 },
        editor: { wordWrap: true },
      };

      // Act
      const result = settingsService.updateSettings(updates);

      // Assert
      expect(result.appearance.fontSize).toBe(18);
      expect(result.appearance.theme).toBe(SETTINGS_DEFAULTS.appearance.theme); // Unchanged
      expect(result.editor.wordWrap).toBe(true);
      expect(result.editor.lineNumbers).toBe(SETTINGS_DEFAULTS.editor.lineNumbers); // Unchanged
    });

    it('should reject invalid data with Zod error', () => {
      // Arrange
      const invalidUpdates = {
        appearance: { fontSize: 999 }, // Exceeds max (24)
      };

      // Act & Assert
      expect(() => settingsService.updateSettings(invalidUpdates)).toThrow();
    });

    it('should reject invalid theme enum', () => {
      // Arrange
      const invalidUpdates = {
        appearance: { theme: 'invalid-theme' as any },
      };

      // Act & Assert
      expect(() => settingsService.updateSettings(invalidUpdates)).toThrow();
    });

    it('should update cache after successful update', () => {
      // Arrange
      const updates = {
        appearance: { theme: 'light' as const },
      };

      // Act
      const firstResult = settingsService.updateSettings(updates);
      vi.mocked(fs.readFileSync).mockClear(); // Clear mock call count
      const secondResult = settingsService.getSettings();

      // Assert
      expect(fs.readFileSync).not.toHaveBeenCalled(); // Uses cache
      expect(secondResult).toBe(firstResult); // Same object reference
      expect(secondResult.appearance.theme).toBe('light');
    });
  });

  describe('resetSettings()', () => {
    beforeEach(() => {
      // Setup: Start with modified settings
      const modifiedSettings = {
        appearance: { theme: 'light' as const, fontSize: 18, iconTheme: 'minimal' as const },
        editor: { wordWrap: true, lineNumbers: false, minimap: true },
        terminal: { defaultShell: 'pwsh' as const },
        extensions: { autoUpdate: false, enableTelemetry: false },
        agents: { defaultConnectionId: '123e4567-e89b-12d3-a456-426614174000' },
        sdd: { enabled: true, blockCommitOnUntrackedCodeChanges: true },
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(modifiedSettings));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    });

    it('should overwrite with SETTINGS_DEFAULTS', () => {
      // Act
      const result = settingsService.resetSettings();

      // Assert
      expect(result).toEqual(SETTINGS_DEFAULTS);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSettingsPath,
        JSON.stringify(SETTINGS_DEFAULTS, null, 2),
        'utf-8'
      );
    });

    it('should clear cache and return defaults', () => {
      // Arrange - First get modified settings
      settingsService.getSettings(); // Load modified settings into cache

      // Act
      const result = settingsService.resetSettings();

      // Assert
      expect(result).toEqual(SETTINGS_DEFAULTS);
      
      // Verify subsequent getSettings() uses cached defaults
      vi.mocked(fs.readFileSync).mockClear();
      const afterReset = settingsService.getSettings();
      expect(fs.readFileSync).not.toHaveBeenCalled(); // Uses cache
      expect(afterReset).toEqual(SETTINGS_DEFAULTS);
    });
  });

  describe('Disk write failure retry logic', () => {
    beforeEach(() => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SETTINGS_DEFAULTS));
      vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('should retry once on write failure and succeed', () => {
      // Arrange
      let callCount = 0;
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('ENOSPC: no space left on device');
        }
        // Second call succeeds
      });

      // Mock Date.now for busy wait
      const originalDateNow = Date.now;
      let mockTime = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        mockTime += 150; // Advance time by 150ms on each call
        return mockTime;
      });

      // Act
      const updates = { appearance: { theme: 'light' as const } };
      const result = settingsService.updateSettings(updates);

      // Assert
      expect(result.appearance.theme).toBe('light');
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Initial + retry

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should throw error after retry fails', () => {
      // Arrange
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      // Mock Date.now for busy wait
      const originalDateNow = Date.now;
      let mockTime = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        mockTime += 150;
        return mockTime;
      });

      // Act & Assert
      const updates = { appearance: { theme: 'light' as const } };
      expect(() => settingsService.updateSettings(updates)).toThrow(
        /Failed to persist settings to disk/
      );
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Initial + retry

      // Cleanup
      Date.now = originalDateNow;
    });
  });

  describe('P3 (Secrets) - Validation', () => {
    beforeEach(() => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SETTINGS_DEFAULTS));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    });

    it('should validate that settings schema contains no secret fields', () => {
      // Arrange - Get settings and verify no secret-like fields exist
      const settings = settingsService.getSettings();
      
      // Assert - Settings schema should not have these fields
      expect(settings).not.toHaveProperty('apiKey');
      expect(settings).not.toHaveProperty('password');
      expect(settings).not.toHaveProperty('token');
      expect(settings).not.toHaveProperty('secret');
      
      // All fields should be UI preferences only
      const keys = ['appearance', 'editor', 'terminal', 'extensions', 'agents', 'sdd'];
      expect(Object.keys(settings).sort()).toEqual(keys.sort());
    });
  });

  describe('P6 (Contracts-first) - Zod schema constraints', () => {
    it('should enforce min fontSize (10)', () => {
      const updates = { appearance: { fontSize: 9 } };
      expect(() => settingsService.updateSettings(updates)).toThrow();
    });

    it('should enforce max fontSize (24)', () => {
      const updates = { appearance: { fontSize: 25 } };
      expect(() => settingsService.updateSettings(updates)).toThrow();
    });

    it('should enforce valid theme enums', () => {
      const invalidThemes = ['invalid', 'blue', 'green'];
      
      invalidThemes.forEach((theme) => {
        settingsService.resetSettings(); // Reset before each attempt
        const updates = { appearance: { theme } as any };
        expect(() => settingsService.updateSettings(updates)).toThrow();
      });
      
      // Test numeric and null values separately (they cause different errors)
      settingsService.resetSettings();
      expect(() => settingsService.updateSettings({ appearance: { theme: 123 as any } })).toThrow();
      
      settingsService.resetSettings();
      expect(() => settingsService.updateSettings({ appearance: { theme: null as any } })).toThrow();
    });

    it('should accept all valid theme enums', () => {
      const validThemes = ['dark', 'light', 'high-contrast-dark', 'high-contrast-light', 'system'];
      
      validThemes.forEach((theme) => {
        // Reset to defaults
        settingsService.resetSettings();
        
        const updates = { appearance: { theme: theme as any } };
        const result = settingsService.updateSettings(updates);
        expect(result.appearance.theme).toBe(theme);
      });
    });

    it('should enforce valid iconTheme enums', () => {
      const validIconThemes = ['default', 'minimal'];
      
      validIconThemes.forEach((iconTheme) => {
        settingsService.resetSettings();
        const updates = { appearance: { iconTheme: iconTheme as any } };
        const result = settingsService.updateSettings(updates);
        expect(result.appearance.iconTheme).toBe(iconTheme);
      });

      const invalidIconTheme = { appearance: { iconTheme: 'invalid' } };
      expect(() => settingsService.updateSettings(invalidIconTheme as any)).toThrow();
    });
  });
});
