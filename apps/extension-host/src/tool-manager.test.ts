import { describe, it, expect, beforeEach } from 'vitest';
import { ToolManager } from './tool-manager';

describe('ToolManager', () => {
  let manager: ToolManager;

  beforeEach(() => {
    manager = new ToolManager();
  });

  it('registers and executes a tool', async () => {
    manager.registerTool(
      'echo',
      'Echo tool',
      { type: 'object' },
      (input) => input,
      'acme.sample-extension'
    );

    const result = await manager.executeTool('acme.sample-extension.echo', { message: 'hi' });

    expect(result).toEqual({ message: 'hi' });
    expect(manager.hasTool('acme.sample-extension.echo')).toBe(true);
  });

  it('unregisters tools for an extension', () => {
    manager.registerTool('t1', 'Tool 1', {}, () => 'ok', 'acme.sample-extension');
    manager.registerTool('t2', 'Tool 2', {}, () => 'ok', 'acme.sample-extension');
    manager.registerTool('t3', 'Tool 3', {}, () => 'ok', 'acme.other');

    manager.unregisterExtensionTools('acme.sample-extension');

    expect(manager.hasTool('acme.sample-extension.t1')).toBe(false);
    expect(manager.hasTool('acme.sample-extension.t2')).toBe(false);
    expect(manager.hasTool('acme.other.t3')).toBe(true);
  });

  it('throws for unknown tool', async () => {
    await expect(manager.executeTool('missing.tool', {})).rejects.toThrow('Tool not found');
  });
});
