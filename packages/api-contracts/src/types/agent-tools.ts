import { z } from 'zod';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)])
);

export const ToolCallEnvelopeSchema = z.object({
  callId: z.string().uuid(),
  toolId: z.string(),
  requesterId: z.string(),
  runId: z.string().uuid(),
  input: JsonValueSchema,
  reason: z.string().optional(),
});

export type ToolCallEnvelope = z.infer<typeof ToolCallEnvelopeSchema>;

export const ToolCallResultSchema = z.object({
  callId: z.string().uuid(),
  toolId: z.string(),
  runId: z.string().uuid(),
  ok: z.boolean(),
  output: JsonValueSchema.optional(),
  error: z.string().optional(),
  durationMs: z.number().int().min(0).optional(),
});

export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

export const PolicyDecisionScopeSchema = z.enum(['run', 'session', 'global']);

export type PolicyDecisionScope = z.infer<typeof PolicyDecisionScopeSchema>;

export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  scope: PolicyDecisionScopeSchema.optional(),
});

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
