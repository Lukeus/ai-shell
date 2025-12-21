/**
 * PermissionService - Enforces extension capabilities before sensitive operations.
 * 
 * P1 (Process Isolation): Permission checks enforced in main process only (not in Extension Host).
 * P3 (Secrets): Extensions never receive raw secret values (handles only).
 * P2 (Security): No secrets in logs; no plaintext secrets on disk.
 */

import { PermissionScope, PermissionGrant } from 'packages-api-contracts';
import { PermissionStorage, PermissionRegistryData } from './permission-storage';

/**
 * Permission check result.
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
}

/**
 * Permission request decision (from user consent dialog).
 */
export type PermissionDecision = 'allow' | 'deny' | 'ask-later';

/**
 * PermissionService manages permission grants and enforces checks.
 * P1: Runs in main process only.
 */
export class PermissionService {
  private storage: PermissionStorage;
  private grants: Map<string, PermissionGrant>;
  private initialized: boolean;

  constructor(storageDir: string) {
    this.storage = new PermissionStorage(storageDir);
    this.grants = new Map();
    this.initialized = false;
  }

  /**
   * Initialize service by loading grants from disk.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[PermissionService] Already initialized');
      return;
    }

    const data = await this.storage.load();
    
    // Populate in-memory map
    for (const [key, grant] of Object.entries(data.grants)) {
      this.grants.set(key, grant);
    }

    this.initialized = true;
    console.log(`[PermissionService] Initialized with ${this.grants.size} permission grants`);
  }

  /**
   * Check if an extension has a specific permission.
   * 
   * @param extensionId - Extension ID
   * @param scope - Permission scope
   * @returns Permission check result
   */
  checkPermission(extensionId: string, scope: PermissionScope): PermissionCheckResult {
    const key = this.makeKey(extensionId, scope);
    const grant = this.grants.get(key);

    if (!grant) {
      return {
        granted: false,
        reason: 'Permission not granted',
      };
    }

    if (!grant.granted) {
      return {
        granted: false,
        reason: 'Permission explicitly denied',
      };
    }

    return { granted: true };
  }

  /**
   * Request a permission for an extension.
   * If not already granted/denied, returns null to indicate user consent needed.
   * 
   * @param extensionId - Extension ID
   * @param scope - Permission scope
   * @param reason - Optional reason for the request
   * @returns Permission check result, or null if user decision needed
   */
  async requestPermission(
    extensionId: string,
    scope: PermissionScope,
    reason?: string
  ): Promise<PermissionCheckResult | null> {
    // Check if already granted/denied
    const existing = this.checkPermission(extensionId, scope);
    if (existing.granted || existing.reason === 'Permission explicitly denied') {
      // Permission already decided
      console.log(
        `[PermissionService] Permission check: ${extensionId} -> ${scope}: ${existing.granted ? 'granted' : 'denied'}`
      );
      return existing;
    }

    // No existing grant - user decision needed
    console.log(
      `[PermissionService] Permission request: ${extensionId} -> ${scope} (reason: ${reason || 'none'})`
    );
    return null;
  }

  /**
   * Grant or deny a permission for an extension.
   * Called after user makes a decision in consent dialog.
   * 
   * @param extensionId - Extension ID
   * @param scope - Permission scope
   * @param decision - User decision
   */
  async recordDecision(
    extensionId: string,
    scope: PermissionScope,
    decision: PermissionDecision
  ): Promise<void> {
    if (decision === 'ask-later') {
      // Don't persist, ask again next time
      return;
    }

    const key = this.makeKey(extensionId, scope);
    const grant: PermissionGrant = {
      extensionId,
      scope,
      granted: decision === 'allow',
      timestamp: Date.now(),
      userDecision: true,
    };

    this.grants.set(key, grant);
    await this.persist();

    console.log(
      `[PermissionService] Permission ${grant.granted ? 'granted' : 'denied'}: ${extensionId} -> ${scope}`
    );
  }

  /**
   * Auto-grant permissions declared in extension manifest.
   * Called during extension installation/activation for declared permissions.
   * 
   * @param extensionId - Extension ID
   * @param scopes - Permission scopes to auto-grant
   */
  async autoGrantPermissions(extensionId: string, scopes: PermissionScope[]): Promise<void> {
    for (const scope of scopes) {
      const key = this.makeKey(extensionId, scope);
      
      // Only auto-grant if not already decided by user
      if (!this.grants.has(key)) {
        const grant: PermissionGrant = {
          extensionId,
          scope,
          granted: true,
          timestamp: Date.now(),
          userDecision: false, // Auto-granted from manifest
        };

        this.grants.set(key, grant);
        console.log(`[PermissionService] Auto-granted permission: ${extensionId} -> ${scope}`);
      }
    }

    await this.persist();
  }

  /**
   * Revoke all permissions for an extension.
   * Called when extension is uninstalled.
   * 
   * @param extensionId - Extension ID
   */
  async revokeAllPermissions(extensionId: string): Promise<void> {
    const toRevoke: string[] = [];

    for (const [key, grant] of this.grants.entries()) {
      if (grant.extensionId === extensionId) {
        toRevoke.push(key);
      }
    }

    for (const key of toRevoke) {
      this.grants.delete(key);
    }

    if (toRevoke.length > 0) {
      await this.persist();
      console.log(`[PermissionService] Revoked ${toRevoke.length} permissions for ${extensionId}`);
    }
  }

  /**
   * Get all granted permissions for an extension.
   */
  getGrantedPermissions(extensionId: string): PermissionGrant[] {
    const result: PermissionGrant[] = [];

    for (const grant of this.grants.values()) {
      if (grant.extensionId === extensionId && grant.granted) {
        result.push(grant);
      }
    }

    return result;
  }

  /**
   * Get all permissions (granted and denied) for an extension.
   */
  getAllPermissions(extensionId: string): PermissionGrant[] {
    const result: PermissionGrant[] = [];

    for (const grant of this.grants.values()) {
      if (grant.extensionId === extensionId) {
        result.push(grant);
      }
    }

    return result;
  }

  /**
   * Persist current grants to disk.
   */
  private async persist(): Promise<void> {
    const data: PermissionRegistryData = {
      version: 1,
      grants: Object.fromEntries(this.grants.entries()),
    };
    await this.storage.save(data);
  }

  /**
   * Create key for grant map: "extensionId:scope".
   */
  private makeKey(extensionId: string, scope: PermissionScope): string {
    return `${extensionId}:${scope}`;
  }

  /**
   * Get storage file path for debugging/testing.
   */
  getStorageFilePath(): string {
    return this.storage.getFilePath();
  }
}
