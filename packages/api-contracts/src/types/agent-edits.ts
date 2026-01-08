import { z } from 'zod';
import { ProposalSchema, ProposalSummarySchema } from './sdd';

export const AgentContextAttachmentKindSchema = z.enum(['file', 'selection', 'snippet']);

export type AgentContextAttachmentKind = z.infer<typeof AgentContextAttachmentKindSchema>;

export const AgentTextRangeSchema = z.object({
  startLineNumber: z.number().int().min(1),
  startColumn: z.number().int().min(1),
  endLineNumber: z.number().int().min(1),
  endColumn: z.number().int().min(1),
});

export type AgentTextRange = z.infer<typeof AgentTextRangeSchema>;

export const AgentContextAttachmentSchema = z.object({
  kind: AgentContextAttachmentKindSchema,
  filePath: z.string().min(1),
  range: AgentTextRangeSchema.optional(),
  snippet: z.string().optional(),
  hash: z.string().optional(),
});

export type AgentContextAttachment = z.infer<typeof AgentContextAttachmentSchema>;

export const AgentEditRequestOptionsSchema = z.object({
  allowWrites: z.boolean().optional(),
  includeTests: z.boolean().optional(),
  maxPatchBytes: z.number().int().min(1).optional(),
});

export type AgentEditRequestOptions = z.infer<typeof AgentEditRequestOptionsSchema>;

export const AgentEditRequestSchema = z.object({
  conversationId: z.string().uuid(),
  prompt: z.string().min(1),
  attachments: z.array(AgentContextAttachmentSchema).default([]),
  connectionId: z.string().uuid().optional(),
  modelRef: z.string().optional(),
  options: AgentEditRequestOptionsSchema.optional(),
});

export type AgentEditRequest = z.infer<typeof AgentEditRequestSchema>;

export const AgentEditRequestResponseSchema = z.object({
  runId: z.string().uuid(),
});

export type AgentEditRequestResponse = z.infer<typeof AgentEditRequestResponseSchema>;

export const AgentEditProposalSchema = z.object({
  summary: z.string().min(1),
  proposal: ProposalSchema,
});

export type AgentEditProposal = z.infer<typeof AgentEditProposalSchema>;

export const ApplyAgentEditProposalRequestSchema = z.object({
  proposal: ProposalSchema,
  conversationId: z.string().uuid().optional(),
  entryId: z.string().uuid().optional(),
});

export type ApplyAgentEditProposalRequest = z.infer<typeof ApplyAgentEditProposalRequestSchema>;

export const ApplyAgentEditProposalResponseSchema = z.object({
  files: z.array(z.string().min(1)),
  summary: ProposalSummarySchema,
});

export type ApplyAgentEditProposalResponse = z.infer<typeof ApplyAgentEditProposalResponseSchema>;
