import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolExecutor } from './executor';
import { ToolRegistry } from './registry';

describe('ToolExecutor', () => {
  it('validates inputs and outputs', async () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'tool.upper',
      description: 'Uppercase',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: (input) => ({ value: String((input as { text: string }).text).toUpperCase() }),
    });

    const executor = new ToolExecutor(registry);
    const result = await executor.execute('tool.upper', { text: 'hello' });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ value: 'HELLO' });
  });

  it('rejects invalid input', async () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'tool.number',
      description: 'Number only',
      inputSchema: z.object({ value: z.number() }),
      execute: () => ({ ok: true }),
    });

    const executor = new ToolExecutor(registry);
    const result = await executor.execute('tool.number', { value: 'nope' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch('Invalid tool input');
  });

  it('rejects invalid output', async () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'tool.output',
      description: 'Bad output',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: () => ({ ok: 'nope' }),
    });

    const executor = new ToolExecutor(registry);
    const result = await executor.execute('tool.output', {});

    expect(result.ok).toBe(false);
    expect(result.error).toMatch('Invalid tool output');
  });
});
