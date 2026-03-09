import { z } from 'zod';

export const AuditEventTypeSchema = z.enum([
  'secret-access',
  'agent-tool-access',
  'agent.proposal.apply',
  'agent.proposal.discard',
  'model-call',
  'sdd.proposal.apply',
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

export const ModelCallAuditStatusSchema = z.enum(['success', 'error']);

export type ModelCallAuditStatus = z.infer<typeof ModelCallAuditStatusSchema>;

export const ModelCallAuditEventSchema = AuditEventBaseSchema.extend({
  type: z.literal('model-call'),
  runId: z.string().uuid(),
  providerId: z.string(),
  connectionId: z.string().uuid(),
  modelRef: z.string().optional(),
  status: ModelCallAuditStatusSchema,
  durationMs: z.number().int().min(0),
  error: z.string().optional(),
});

export type ModelCallAuditEvent = z.infer<typeof ModelCallAuditEventSchema>;

export const AgentProposalApplyAuditStatusSchema = z.enum(['success', 'error']);

export type AgentProposalApplyAuditStatus = z.infer<
  typeof AgentProposalApplyAuditStatusSchema
>;

export const AgentProposalApplyAuditEventSchema = AuditEventBaseSchema.extend({
  type: z.literal('agent.proposal.apply'),
  conversationId: z.string().uuid().optional(),
  entryId: z.string().uuid().optional(),
  status: AgentProposalApplyAuditStatusSchema,
  filesChanged: z.number().int().nonnegative(),
  files: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type AgentProposalApplyAuditEvent = z.infer<
  typeof AgentProposalApplyAuditEventSchema
>;

export const AgentProposalDiscardAuditEventSchema = AuditEventBaseSchema.extend({
  type: z.literal('agent.proposal.discard'),
  conversationId: z.string().uuid(),
  entryId: z.string().uuid(),
});

export type AgentProposalDiscardAuditEvent = z.infer<
  typeof AgentProposalDiscardAuditEventSchema
>;

export const SddProposalApplyStatusSchema = z.enum(['success', 'error']);

export type SddProposalApplyStatus = z.infer<typeof SddProposalApplyStatusSchema>;

export const SddProposalApplyAuditEventSchema = AuditEventBaseSchema.extend({
  type: z.literal('sdd.proposal.apply'),
  runId: z.string().uuid(),
  status: SddProposalApplyStatusSchema,
  filesChanged: z.number().int().nonnegative(),
  files: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type SddProposalApplyAuditEvent = z.infer<typeof SddProposalApplyAuditEventSchema>;

export const AuditEventSchema = z.discriminatedUnion('type', [
  SecretAccessAuditEventSchema,
  AgentToolAccessAuditEventSchema,
  AgentProposalApplyAuditEventSchema,
  AgentProposalDiscardAuditEventSchema,
  ModelCallAuditEventSchema,
  SddProposalApplyAuditEventSchema,
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
