import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ExtensionRegistry } from './extension-registry';
import { ExtensionManifest } from 'packages-api-contracts';

describe('ExtensionRegistry', () => {
  let tempDir: string;
  let registry: ExtensionRegistry;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'extension-registry-test-'));
    registry = new ExtensionRegistry(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  });

  describe('initialize', () => {
    it('should initialize with empty registry when no extensions exist', async () => {
      await registry.initialize();
      
      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(0);
    });

    it('should load valid extensions from directory', async () => {
      // Create extension directory with valid manifest
      const extDir = path.join(tempDir, 'test-extension');
      await fs.mkdir(extDir, { recursive: true });
      
      const manifest: ExtensionManifest = {
        id: 'test.extension',
        name: 'Test Extension',
        version: '1.0.0',
        publisher: 'test',
        main: './index.js',
        activationEvents: ['onStartup'],
        permissions: ['ui'],
      };
      
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify(manifest, null, 2)
      );

      await registry.initialize();
      
      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(1);
      expect(extensions[0].manifest.id).toBe('test.extension');
      expect(extensions[0].enabled).toBe(true);
    });

    it('should skip extensions with invalid manifests', async () => {
      // Create valid extension
      const validDir = path.join(tempDir, 'valid-extension');
      await fs.mkdir(validDir, { recursive: true });
      await fs.writeFile(
        path.join(validDir, 'package.json'),
        JSON.stringify({
          id: 'valid.extension',
          name: 'Valid',
          version: '1.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );

      // Create invalid extension (missing required fields)
      const invalidDir = path.join(tempDir, 'invalid-extension');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        path.join(invalidDir, 'package.json'),
        JSON.stringify({ id: 'invalid.extension' })
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await registry.initialize();
      
      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(1);
      expect(extensions[0].manifest.id).toBe('valid.extension');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid manifest'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('should skip directories without package.json', async () => {
      const extDir = path.join(tempDir, 'no-manifest');
      await fs.mkdir(extDir, { recursive: true });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await registry.initialize();
      
      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No package.json found')
      );

      consoleSpy.mockRestore();
    });

    it('should skip extensions with malformed JSON', async () => {
      const extDir = path.join(tempDir, 'bad-json');
      await fs.mkdir(extDir, { recursive: true });
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        '{ invalid json }'
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await registry.initialize();
      
      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON')
      );

      consoleSpy.mockRestore();
    });

    it('should not initialize twice', async () => {
      await registry.initialize();
      
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await registry.initialize();
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );

      warnSpy.mockRestore();
    });
  });

  describe('persistence', () => {
    it('should persist registry to disk', async () => {
      const extDir = path.join(tempDir, 'test-extension');
      await fs.mkdir(extDir, { recursive: true });
      
      const manifest: ExtensionManifest = {
        id: 'test.extension',
        name: 'Test Extension',
        version: '1.0.0',
        publisher: 'test',
        main: './index.js',
        activationEvents: ['onStartup'],
        permissions: ['ui'],
      };
      
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify(manifest)
      );

      await registry.initialize();

      // Check registry file was created
      const registryPath = registry.getStorageFilePath();
      const exists = await fs.access(registryPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Load registry in new instance
      const registry2 = new ExtensionRegistry(tempDir);
      await registry2.initialize();
      
      const extensions = registry2.getAllExtensions();
      expect(extensions).toHaveLength(1);
      expect(extensions[0].manifest.id).toBe('test.extension');
    });
  });

  describe('getExtension', () => {
    it('should return extension by ID', async () => {
      const extDir = path.join(tempDir, 'test-extension');
      await fs.mkdir(extDir, { recursive: true });
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify({
          id: 'test.extension',
          name: 'Test',
          version: '1.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );

      await registry.initialize();
      
      const ext = registry.getExtension('test.extension');
      expect(ext).toBeDefined();
      expect(ext?.manifest.name).toBe('Test');
    });

    it('should return undefined for unknown ID', async () => {
      await registry.initialize();
      
      const ext = registry.getExtension('unknown.extension');
      expect(ext).toBeUndefined();
    });
  });

  describe('enableExtension / disableExtension', () => {
    beforeEach(async () => {
      const extDir = path.join(tempDir, 'test-extension');
      await fs.mkdir(extDir, { recursive: true });
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify({
          id: 'test.extension',
          name: 'Test',
          version: '1.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );
      await registry.initialize();
    });

    it('should disable extension', async () => {
      const result = await registry.disableExtension('test.extension');
      expect(result).toBe(true);
      
      const ext = registry.getExtension('test.extension');
      expect(ext?.enabled).toBe(false);
    });

    it('should enable extension', async () => {
      await registry.disableExtension('test.extension');
      
      const result = await registry.enableExtension('test.extension');
      expect(result).toBe(true);
      
      const ext = registry.getExtension('test.extension');
      expect(ext?.enabled).toBe(true);
    });

    it('should return false for unknown extension', async () => {
      const result = await registry.disableExtension('unknown.extension');
      expect(result).toBe(false);
    });

    it('should persist enabled state', async () => {
      await registry.disableExtension('test.extension');
      
      // Load in new instance
      const registry2 = new ExtensionRegistry(tempDir);
      await registry2.initialize();
      
      const ext = registry2.getExtension('test.extension');
      expect(ext?.enabled).toBe(false);
    });
  });

  describe('getEnabledExtensions', () => {
    it('should return only enabled extensions', async () => {
      // Create two extensions
      for (let i = 1; i <= 2; i++) {
        const extDir = path.join(tempDir, `extension-${i}`);
        await fs.mkdir(extDir, { recursive: true });
        await fs.writeFile(
          path.join(extDir, 'package.json'),
          JSON.stringify({
            id: `test.extension${i}`,
            name: `Test ${i}`,
            version: '1.0.0',
            publisher: 'test',
            main: './index.js',
            activationEvents: [],
            permissions: [],
          })
        );
      }

      await registry.initialize();
      await registry.disableExtension('test.extension2');
      
      const enabled = registry.getEnabledExtensions();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].manifest.id).toBe('test.extension1');
    });
  });

  describe('uninstallExtension', () => {
    it('should remove extension from registry', async () => {
      const extDir = path.join(tempDir, 'test-extension');
      await fs.mkdir(extDir, { recursive: true });
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify({
          id: 'test.extension',
          name: 'Test',
          version: '1.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );

      await registry.initialize();
      expect(registry.getAllExtensions()).toHaveLength(1);
      
      const result = await registry.uninstallExtension('test.extension');
      expect(result).toBe(true);
      expect(registry.getAllExtensions()).toHaveLength(0);
    });

    it('should return false for unknown extension', async () => {
      await registry.initialize();
      
      const result = await registry.uninstallExtension('unknown.extension');
      expect(result).toBe(false);
    });
  });

  describe('rescan', () => {
    it('should detect newly added extensions', async () => {
      await registry.initialize();
      expect(registry.getAllExtensions()).toHaveLength(0);
      
      // Add extension after initialization
      const extDir = path.join(tempDir, 'new-extension');
      await fs.mkdir(extDir, { recursive: true });
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify({
          id: 'new.extension',
          name: 'New',
          version: '1.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );

      await registry.rescan();
      
      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(1);
      expect(extensions[0].manifest.id).toBe('new.extension');
    });

    it('should detect version updates', async () => {
      const extDir = path.join(tempDir, 'test-extension');
      await fs.mkdir(extDir, { recursive: true });
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify({
          id: 'test.extension',
          name: 'Test',
          version: '1.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );

      await registry.initialize();
      
      // Update version
      await fs.writeFile(
        path.join(extDir, 'package.json'),
        JSON.stringify({
          id: 'test.extension',
          name: 'Test',
          version: '2.0.0',
          publisher: 'test',
          main: './index.js',
          activationEvents: [],
          permissions: [],
        })
      );

      await registry.rescan();
      
      const ext = registry.getExtension('test.extension');
      expect(ext?.manifest.version).toBe('2.0.0');
    });
  });
});
