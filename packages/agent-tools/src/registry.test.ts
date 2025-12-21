import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'tool.echo',
      description: 'Echo input',
      inputSchema: z.object({ message: z.string() }),
      execute: (input) => input,
    });

    const tool = registry.get('tool.echo');
    expect(tool?.id).toBe('tool.echo');
  });

  it('lists tools', () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'tool.a',
      description: 'Tool A',
      inputSchema: z.object({}),
      execute: () => null,
    });
    registry.register({
      id: 'tool.b',
      description: 'Tool B',
      inputSchema: z.object({}),
      execute: () => null,
    });

    const ids = registry.list().map((tool) => tool.id);
    expect(ids).toContain('tool.a');
    expect(ids).toContain('tool.b');
  });

  it('unregisters tools', () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'tool.temp',
      description: 'Temp',
      inputSchema: z.object({}),
      execute: () => null,
    });
    registry.unregister('tool.temp');
    expect(registry.get('tool.temp')).toBeUndefined();
  });
});
