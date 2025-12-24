import { z } from 'zod';

/**
 * Test-only request to force a renderer crash.
 */
export const TestForceCrashRendererRequestSchema = z.object({});

export type TestForceCrashRendererRequest = z.infer<
  typeof TestForceCrashRendererRequestSchema
>;

/**
 * Test-only response for renderer crash request.
 */
export const TestForceCrashRendererResponseSchema = z.object({
  triggered: z.boolean(),
});

export type TestForceCrashRendererResponse = z.infer<
  typeof TestForceCrashRendererResponseSchema
>;
