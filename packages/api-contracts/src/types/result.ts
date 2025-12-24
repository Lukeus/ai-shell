import { z } from 'zod';

/**
 * Minimal error payload for Result envelopes.
 */
export const ErrorInfoSchema = z.object({
  message: z.string().min(1),
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  stack: z.string().optional(),
});

export type ErrorInfo = z.infer<typeof ErrorInfoSchema>;

/**
 * Result envelope with discriminated union on `ok`.
 */
export const ResultSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: ErrorInfoSchema }),
  ]);

export type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorInfo };
