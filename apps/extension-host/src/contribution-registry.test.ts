import { describe, it, expect, beforeEach } from 'vitest';
import { ContributionRegistry } from './contribution-registry';
import type { ExtensionManifest } from 'packages-api-contracts';

describe('ContributionRegistry', () => {
  let registry: ContributionRegistry;

  beforeEach(() => {
    registry = new ContributionRegistry();
  });

  it('registers and retrieves contributions', () => {
    const manifest: ExtensionManifest = {
      id: 'acme.sample-extension',
      name: 'sample-extension',
      version: '1.0.0',
      publisher: 'acme',
      main: 'index.js',
      activationEvents: ['onStartup'],
      permissions: ['ui'],
      contributes: {
        commands: [{ id: 'sample.hello', title: 'Hello' }],
        views: [{ id: 'sample.view', name: 'Sample View', location: 'panel' }],
        tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object' } }],
        settings: [{ key: 'sample.setting', type: 'string', default: 'value' }],
        connectionProviders: [
          {
            id: 'sample.provider',
            name: 'Sample',
            fields: [
              {
                id: 'endpoint',
                label: 'Endpoint',
                type: 'string',
              },
            ],
          },
        ],
        mcpServers: [
          {
            id: 'sample.mcp',
            name: 'Sample MCP',
            transport: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
        ],
      },
    };

    registry.registerContributions(manifest);

    expect(registry.getCommand('sample.hello')).toBeDefined();
    expect(registry.getView('sample.view')).toBeDefined();
    expect(registry.getTool('echo')).toBeDefined();
    expect(registry.getSetting('sample.setting')).toBeDefined();
    expect(registry.getConnectionProvider('sample.provider')).toBeDefined();
    expect(registry.getMcpServer('acme.sample-extension', 'sample.mcp')).toBeDefined();
  });

  it('unregisters contributions for an extension', () => {
    const manifest: ExtensionManifest = {
      id: 'acme.sample-extension',
      name: 'sample-extension',
      version: '1.0.0',
      publisher: 'acme',
      main: 'index.js',
      activationEvents: ['onStartup'],
      permissions: ['ui'],
      contributes: {
        commands: [{ id: 'sample.hello', title: 'Hello' }],
        mcpServers: [
          {
            id: 'sample.mcp',
            name: 'Sample MCP',
            transport: 'stdio',
            command: 'node',
          },
        ],
      },
    };

    registry.registerContributions(manifest);
    registry.unregisterContributions('acme.sample-extension');

    expect(registry.getCommand('sample.hello')).toBeUndefined();
    expect(registry.getMcpServer('acme.sample-extension', 'sample.mcp')).toBeUndefined();
  });
});
