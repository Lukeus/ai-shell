import { z } from 'zod';

export const AuditEventTypeSchema = z.enum([
  'secret-access',
  'agent-tool-access',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

const AuditEventBaseSchema = z.object({
  id: z.string().uuid(),
  type: AuditEventTypeSchema,
  createdAt: z.string().datetime(),
});

export const SecretAccessAuditEventSchema = AuditEventBaseSchema.extend({
  type: z.literal('secret-access'),
  connectionId: z.string().uuid(),
  requesterId: z.string(),
  reason: z.string().optional(),
  allowed: z.boolean(),
});

export type SecretAccessAuditEvent = z.infer<typeof SecretAccessAuditEventSchema>;

export const AgentToolAccessAuditEventSchema = AuditEventBaseSchema.extend({
  type: z.literal('agent-tool-access'),
  runId: z.string().uuid(),
  toolId: z.string(),
  requesterId: z.string(),
  reason: z.string().optional(),
  allowed: z.boolean(),
});

export type AgentToolAccessAuditEvent = z.infer<typeof AgentToolAccessAuditEventSchema>;

export const AuditEventSchema = z.discriminatedUnion('type', [
  SecretAccessAuditEventSchema,
  AgentToolAccessAuditEventSchema,
]);

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const ListAuditEventsRequestSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  cursor: z.string().optional(),
});

export type ListAuditEventsRequest = z.infer<typeof ListAuditEventsRequestSchema>;

export const ListAuditEventsResponseSchema = z.object({
  events: z.array(AuditEventSchema),
  nextCursor: z.string().optional(),
});

export type ListAuditEventsResponse = z.infer<typeof ListAuditEventsResponseSchema>;
