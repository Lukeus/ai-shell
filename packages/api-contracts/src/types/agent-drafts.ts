import { z } from 'zod';

export const AgentDraftStatusSchema = z.enum(['draft', 'saved']);

export type AgentDraftStatus = z.infer<typeof AgentDraftStatusSchema>;

export const AgentDraftSchema = z.object({
  featureId: z.string().min(1),
  spec: z.string(),
  plan: z.string(),
  tasks: z.string(),
  status: AgentDraftStatusSchema,
});

export type AgentDraft = z.infer<typeof AgentDraftSchema>;

export const SaveAgentDraftRequestSchema = z.object({
  draft: AgentDraftSchema,
  allowOverwrite: z.boolean().optional(),
});

export type SaveAgentDraftRequest = z.infer<typeof SaveAgentDraftRequestSchema>;

export const SaveAgentDraftResponseSchema = z.object({
  featureId: z.string().min(1),
  specPath: z.string(),
  planPath: z.string(),
  tasksPath: z.string(),
  savedAt: z.string().datetime(),
});

export type SaveAgentDraftResponse = z.infer<typeof SaveAgentDraftResponseSchema>;
