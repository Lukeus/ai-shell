import { z } from 'zod';
import { ProposalModeSchema, ProposalSchema, ProposalSummarySchema } from './sdd';

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
  mode: ProposalModeSchema,
  changeSummary: ProposalSummarySchema,
  proposal: ProposalSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.proposal) {
    return;
  }
  if (value.proposal.mode !== value.mode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Agent edit proposal mode must match the embedded proposal mode.',
      path: ['mode'],
    });
  }
  if (
    value.proposal.summary.filesChanged !== value.changeSummary.filesChanged ||
    value.proposal.summary.additions !== value.changeSummary.additions ||
    value.proposal.summary.deletions !== value.changeSummary.deletions
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Agent edit proposal summary must match the embedded proposal summary.',
      path: ['changeSummary'],
    });
  }
});

export type AgentEditProposal = z.infer<typeof AgentEditProposalSchema>;

export const ApplyAgentEditProposalRequestSchema = z.object({
  proposal: ProposalSchema.optional(),
  conversationId: z.string().uuid().optional(),
  entryId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (!value.proposal && !value.entryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Apply proposal requests must include a proposal or an entryId.',
      path: ['proposal'],
    });
  }
  if (value.entryId && !value.conversationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'conversationId is required when entryId is provided.',
      path: ['conversationId'],
    });
  }
});

export type ApplyAgentEditProposalRequest = z.infer<typeof ApplyAgentEditProposalRequestSchema>;

export const ApplyAgentEditProposalResponseSchema = z.object({
  files: z.array(z.string().min(1)),
  summary: ProposalSummarySchema,
  state: z.literal('applied'),
  appliedAt: z.string().datetime(),
});

export type ApplyAgentEditProposalResponse = z.infer<typeof ApplyAgentEditProposalResponseSchema>;

export const DiscardAgentEditProposalRequestSchema = z.object({
  conversationId: z.string().uuid(),
  entryId: z.string().uuid(),
});

export type DiscardAgentEditProposalRequest = z.infer<
  typeof DiscardAgentEditProposalRequestSchema
>;

export const DiscardAgentEditProposalResponseSchema = z.object({
  state: z.literal('discarded'),
  discardedAt: z.string().datetime(),
});

export type DiscardAgentEditProposalResponse = z.infer<
  typeof DiscardAgentEditProposalResponseSchema
>;
