import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { PermissionService } from './permission-service';
import { PermissionScope } from 'packages-api-contracts';

describe('PermissionService', () => {
  let tempDir: string;
  let permissionService: PermissionService;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'permission-service-test-'));
    permissionService = new PermissionService(tempDir);
    await permissionService.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  });

  describe('checkPermission', () => {
    it('should return not granted for unknown permission', () => {
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Permission not granted');
    });

    it('should return granted after permission is granted', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      
      expect(result.granted).toBe(true);
    });

    it('should return denied after permission is denied', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'deny');
      
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Permission explicitly denied');
    });
  });

  describe('requestPermission', () => {
    it('should return null for first-time request (user decision needed)', async () => {
      const result = await permissionService.requestPermission(
        'test.extension',
        'filesystem.read',
        'Need to read files'
      );
      
      expect(result).toBeNull();
    });

    it('should return existing grant if already granted', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      
      const result = await permissionService.requestPermission('test.extension', 'filesystem.read');
      
      expect(result).not.toBeNull();
      expect(result?.granted).toBe(true);
    });

    it('should return existing denial if already denied', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'deny');
      
      const result = await permissionService.requestPermission('test.extension', 'filesystem.read');
      
      expect(result).not.toBeNull();
      expect(result?.granted).toBe(false);
    });
  });

  describe('recordDecision', () => {
    it('should grant permission when user allows', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      expect(result.granted).toBe(true);
    });

    it('should deny permission when user denies', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'deny');
      
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      expect(result.granted).toBe(false);
    });

    it('should not persist when user chooses ask-later', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'ask-later');
      
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Permission not granted');
    });

    it('should persist decisions to disk', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      
      // Create new service instance to load from disk
      const service2 = new PermissionService(tempDir);
      await service2.initialize();
      
      const result = service2.checkPermission('test.extension', 'filesystem.read');
      expect(result.granted).toBe(true);
    });
  });

  describe('autoGrantPermissions', () => {
    it('should auto-grant declared permissions', async () => {
      const scopes: PermissionScope[] = ['filesystem.read', 'filesystem.write'];
      
      await permissionService.autoGrantPermissions('test.extension', scopes);
      
      const result1 = permissionService.checkPermission('test.extension', 'filesystem.read');
      const result2 = permissionService.checkPermission('test.extension', 'filesystem.write');
      
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(true);
    });

    it('should not override existing user decisions', async () => {
      // User denies the permission first
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'deny');
      
      // Try to auto-grant
      await permissionService.autoGrantPermissions('test.extension', ['filesystem.read']);
      
      // Should still be denied (user decision takes precedence)
      const result = permissionService.checkPermission('test.extension', 'filesystem.read');
      expect(result.granted).toBe(false);
    });
  });

  describe('revokeAllPermissions', () => {
    it('should revoke all permissions for an extension', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      await permissionService.recordDecision('test.extension', 'filesystem.write', 'allow');
      await permissionService.recordDecision('other.extension', 'network.http', 'allow');
      
      await permissionService.revokeAllPermissions('test.extension');
      
      const result1 = permissionService.checkPermission('test.extension', 'filesystem.read');
      const result2 = permissionService.checkPermission('test.extension', 'filesystem.write');
      const result3 = permissionService.checkPermission('other.extension', 'network.http');
      
      expect(result1.granted).toBe(false);
      expect(result2.granted).toBe(false);
      expect(result3.granted).toBe(true); // Other extension unaffected
    });
  });

  describe('getGrantedPermissions', () => {
    it('should return only granted permissions', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      await permissionService.recordDecision('test.extension', 'filesystem.write', 'deny');
      await permissionService.recordDecision('test.extension', 'network.http', 'allow');
      
      const granted = permissionService.getGrantedPermissions('test.extension');
      
      expect(granted).toHaveLength(2);
      expect(granted.map((g) => g.scope)).toEqual(
        expect.arrayContaining(['filesystem.read', 'network.http'])
      );
    });

    it('should return empty array for extension with no granted permissions', () => {
      const granted = permissionService.getGrantedPermissions('unknown.extension');
      expect(granted).toHaveLength(0);
    });
  });

  describe('getAllPermissions', () => {
    it('should return both granted and denied permissions', async () => {
      await permissionService.recordDecision('test.extension', 'filesystem.read', 'allow');
      await permissionService.recordDecision('test.extension', 'filesystem.write', 'deny');
      
      const all = permissionService.getAllPermissions('test.extension');
      
      expect(all).toHaveLength(2);
      expect(all.find((p) => p.scope === 'filesystem.read')?.granted).toBe(true);
      expect(all.find((p) => p.scope === 'filesystem.write')?.granted).toBe(false);
    });
  });
});
