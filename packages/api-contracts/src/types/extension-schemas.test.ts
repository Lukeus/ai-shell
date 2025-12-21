import { describe, it, expect } from 'vitest';
import { ExtensionManifestSchema } from './extension-manifest';
import { PermissionScopeSchema } from './extension-permissions';
import { ExtHostRequestSchema, MainToExtHostNotificationSchema } from './extension-host-protocol';
import { ExtensionStateChangeEventSchema } from './extension-events';
import { ExtensionRegistryItemSchema } from './extension-registry';

describe('Extension schemas', () => {
  it('validates a minimal extension manifest', () => {
    const manifest = {
      id: 'acme.sample-extension',
      name: 'sample-extension',
      version: '1.0.0',
      publisher: 'acme',
      main: 'index.js',
      activationEvents: ['onStartup'],
      permissions: ['ui'],
    };

    expect(ExtensionManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it('rejects invalid permission scopes', () => {
    expect(() => PermissionScopeSchema.parse('filesystem.execute')).toThrow();
  });

  it('validates JSON-RPC extension host requests', () => {
    const request = {
      method: 'executeCommand',
      params: { command: 'sample.hello', args: [] },
    };

    expect(ExtHostRequestSchema.parse(request)).toEqual(request);
  });

  it('validates JSON-RPC notifications', () => {
    const notification = {
      method: 'shutdown',
      params: {},
    };

    expect(MainToExtHostNotificationSchema.parse(notification)).toEqual(notification);
  });

  it('validates extension state change events', () => {
    const event = {
      extensionId: 'acme.sample-extension',
      state: 'active',
      timestamp: Date.now(),
    };

    expect(ExtensionStateChangeEventSchema.parse(event)).toEqual(event);
  });

  it('validates extension registry items', () => {
    const now = new Date().toISOString();
    const registryItem = {
      manifest: {
        id: 'acme.sample-extension',
        name: 'sample-extension',
        version: '1.0.0',
        publisher: 'acme',
        main: 'index.js',
        activationEvents: ['onStartup'],
        permissions: ['ui'],
      },
      enabled: true,
      installedAt: now,
      updatedAt: now,
    };

    expect(ExtensionRegistryItemSchema.parse(registryItem)).toEqual(registryItem);
  });
});
