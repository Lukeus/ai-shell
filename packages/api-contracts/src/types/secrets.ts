import { z } from 'zod';

export const SecretRefSchema = z.string().min(1);

export type SecretRef = z.infer<typeof SecretRefSchema>;

export const ConsentDecisionSchema = z.enum(['allow-once', 'allow-always', 'deny']);

export type ConsentDecision = z.infer<typeof ConsentDecisionSchema>;

export const SetSecretRequestSchema = z.object({
  connectionId: z.string().uuid(),
  secretValue: z.string().min(1),
});

export type SetSecretRequest = z.infer<typeof SetSecretRequestSchema>;

export const SetSecretResponseSchema = z.object({
  secretRef: SecretRefSchema,
});

export type SetSecretResponse = z.infer<typeof SetSecretResponseSchema>;

export const ReplaceSecretRequestSchema = z.object({
  connectionId: z.string().uuid(),
  secretValue: z.string().min(1),
});

export type ReplaceSecretRequest = z.infer<typeof ReplaceSecretRequestSchema>;

export const ReplaceSecretResponseSchema = z.object({
  secretRef: SecretRefSchema,
});

export type ReplaceSecretResponse = z.infer<typeof ReplaceSecretResponseSchema>;

export const SecretAccessRequestSchema = z.object({
  connectionId: z.string().uuid(),
  requesterId: z.string(),
  reason: z.string().optional(),
  decision: ConsentDecisionSchema.optional(),
});

export type SecretAccessRequest = z.infer<typeof SecretAccessRequestSchema>;

export const SecretAccessResponseSchema = z.object({
  granted: z.boolean(),
  secretRef: SecretRefSchema.optional(),
});

export type SecretAccessResponse = z.infer<typeof SecretAccessResponseSchema>;
