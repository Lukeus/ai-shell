import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

let lastHandler: ((event: unknown, input: unknown) => Promise<unknown>) | null = null;

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((_channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
      lastHandler = handler;
    }),
  },
}));

import { handleSafe } from './safeIpc';
describe('handleSafe', () => {
  beforeEach(() => {
    lastHandler = null;
    vi.clearAllMocks();
  });

  it('wraps successful results with ok=true', async () => {
    handleSafe(
      'safe:test',
      {
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ total: z.number() }),
      },
      (_event, input) => ({ total: input.value + 1 })
    );

    expect(lastHandler).not.toBeNull();
    const result = await lastHandler?.({}, { value: 3 });
    expect(result).toEqual({ ok: true, value: { total: 4 } });
  });

  it('returns ok=false on handler errors', async () => {
    handleSafe('safe:throw', {}, () => {
      throw new Error('Boom');
    });

    expect(lastHandler).not.toBeNull();
    const result = await lastHandler?.({}, undefined);
    expect(result).toMatchObject({ ok: false, error: { message: 'Boom' } });
  });

  it('returns ok=false on output validation failure', async () => {
    handleSafe(
      'safe:output',
      { outputSchema: z.object({ name: z.string() }) },
      () => ({ name: 123 as unknown as string })
    );

    expect(lastHandler).not.toBeNull();
    const result = await lastHandler?.({}, undefined);
    expect(result).toMatchObject({ ok: false });
  });
});
