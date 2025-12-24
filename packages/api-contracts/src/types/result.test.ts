import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ResultSchema } from './result';

describe('Result contracts', () => {
  it('accepts ok results with a value', () => {
    const schema = ResultSchema(z.string());
    const parsed = schema.parse({ ok: true, value: 'ok' });
    expect(parsed).toEqual({ ok: true, value: 'ok' });
  });

  it('accepts error results with message', () => {
    const schema = ResultSchema(z.number());
    const parsed = schema.parse({ ok: false, error: { message: 'failed' } });
    expect(parsed).toEqual({ ok: false, error: { message: 'failed' } });
  });

  it('rejects invalid ok payloads', () => {
    const schema = ResultSchema(z.string());
    expect(() => schema.parse({ ok: true })).toThrow();
  });
});
