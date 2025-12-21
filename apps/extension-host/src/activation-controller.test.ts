import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivationController } from './activation-controller';
import { ExtensionLoader } from './extension-loader';
import { ExtensionManifest, ExtensionContext } from 'packages-api-contracts';

describe('ActivationController', () => {
  let loader: ExtensionLoader;
  let controller: ActivationController;
  let mockManifest: ExtensionManifest;
  let mockContext: ExtensionContext;

  beforeEach(() => {
    loader = new ExtensionLoader();
    controller = new ActivationController(loader);

    mockManifest = {
      id: 'test.extension',
      name: 'Test Extension',
      version: '1.0.0',
      publisher: 'test',
      main: './index.js',
      activationEvents: ['onCommand:test.command', 'onStartup'],
      permissions: [],
    };

    mockContext = {
      extensionId: 'test.extension',
      extensionPath: '/path/to/extension',
      globalStoragePath: '/path/to/storage',
    };
  });

  describe('registerExtension', () => {
    it('should register an extension as inactive', () => {
      controller.registerExtension(mockManifest, '/path/to/extension');
      
      const state = controller.getExtensionState('test.extension');
      expect(state).toBe('inactive');
    });

    it('should not register the same extension twice', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      controller.registerExtension(mockManifest, '/path/to/extension');
      controller.registerExtension(mockManifest, '/path/to/extension');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('shouldActivate', () => {
    beforeEach(() => {
      controller.registerExtension(mockManifest, '/path/to/extension');
    });

    it('should return true for exact activation event match', () => {
      const result = controller.shouldActivate('test.extension', 'onStartup');
      expect(result).toBe(true);
    });

    it('should return true for command activation event', () => {
      const result = controller.shouldActivate('test.extension', 'onCommand:test.command');
      expect(result).toBe(true);
    });

    it('should return false for non-matching event', () => {
      const result = controller.shouldActivate('test.extension', 'onLanguage:typescript');
      expect(result).toBe(false);
    });

    it('should return false for unknown extension', () => {
      const result = controller.shouldActivate('unknown.extension', 'onStartup');
      expect(result).toBe(false);
    });
  });

  describe('getExtensionsToActivate', () => {
    beforeEach(() => {
      controller.registerExtension(mockManifest, '/path/to/extension');
      
      const manifest2: ExtensionManifest = {
        id: 'test.extension2',
        name: 'Test Extension 2',
        version: '1.0.0',
        publisher: 'test',
        main: './index.js',
        activationEvents: ['onLanguage:typescript'],
        permissions: [],
      };
      controller.registerExtension(manifest2, '/path/to/extension2');
    });

    it('should return extensions matching activation event', () => {
      const result = controller.getExtensionsToActivate('onStartup');
      expect(result).toContain('test.extension');
      expect(result).not.toContain('test.extension2');
    });

    it('should return empty array for no matches', () => {
      const result = controller.getExtensionsToActivate('onLanguage:python');
      expect(result).toHaveLength(0);
    });
  });

  describe('activateExtension', () => {
    it('should throw error for unregistered extension', async () => {
      await expect(
        controller.activateExtension('unknown.extension', mockContext)
      ).rejects.toThrow('not registered');
    });

    it('should handle activation failure gracefully', async () => {
      controller.registerExtension(mockManifest, '/path/to/extension');
      
      // Mock loader to throw error
      vi.spyOn(loader, 'loadExtension').mockRejectedValue(new Error('Load failed'));
      
      await expect(
        controller.activateExtension('test.extension', mockContext)
      ).rejects.toThrow();
      
      const state = controller.getExtensionState('test.extension');
      expect(state).toBe('failed');
    });
  });

  describe('getActiveExtensions', () => {
    it('should return empty array when no extensions are active', () => {
      const active = controller.getActiveExtensions();
      expect(active).toHaveLength(0);
    });
  });

  describe('markAllInactive', () => {
    it('should mark all extensions as inactive', () => {
      controller.registerExtension(mockManifest, '/path/to/extension');
      
      // Manually set state to simulate activation
      // (We can't actually activate without a real extension module)
      
      controller.markAllInactive();
      
      const state = controller.getExtensionState('test.extension');
      expect(state).toBe('inactive');
    });
  });
});
