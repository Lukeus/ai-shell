import { z } from 'zod';
import { AgentContextAttachmentSchema, AgentEditProposalSchema } from './agent-edits';

export const AgentConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentConversation = z.infer<typeof AgentConversationSchema>;

export const AgentMessageRoleSchema = z.enum(['user', 'agent', 'system']);

export type AgentMessageRole = z.infer<typeof AgentMessageRoleSchema>;

export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: AgentMessageRoleSchema,
  content: z.string().min(1),
  attachments: z.array(AgentContextAttachmentSchema).optional(),
  createdAt: z.string().datetime(),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentConversationMessageEntrySchema = AgentMessageSchema.extend({
  type: z.literal('message'),
});

export type AgentConversationMessageEntry = z.infer<
  typeof AgentConversationMessageEntrySchema
>;

export const AgentConversationProposalEntrySchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  type: z.literal('proposal'),
  proposal: AgentEditProposalSchema,
  createdAt: z.string().datetime(),
});

export type AgentConversationProposalEntry = z.infer<
  typeof AgentConversationProposalEntrySchema
>;

export const AgentConversationEntrySchema = z.discriminatedUnion('type', [
  AgentConversationMessageEntrySchema,
  AgentConversationProposalEntrySchema,
]);

export type AgentConversationEntry = z.infer<typeof AgentConversationEntrySchema>;

export const ListAgentConversationsRequestSchema = z.object({});

export type ListAgentConversationsRequest = z.infer<
  typeof ListAgentConversationsRequestSchema
>;

export const ListAgentConversationsResponseSchema = z.object({
  conversations: z.array(AgentConversationSchema),
});

export type ListAgentConversationsResponse = z.infer<
  typeof ListAgentConversationsResponseSchema
>;

export const CreateAgentConversationRequestSchema = z.object({
  title: z.string().min(1).optional(),
});

export type CreateAgentConversationRequest = z.infer<
  typeof CreateAgentConversationRequestSchema
>;

export const CreateAgentConversationResponseSchema = z.object({
  conversation: AgentConversationSchema,
});

export type CreateAgentConversationResponse = z.infer<
  typeof CreateAgentConversationResponseSchema
>;

export const GetAgentConversationRequestSchema = z.object({
  conversationId: z.string().uuid(),
});

export type GetAgentConversationRequest = z.infer<
  typeof GetAgentConversationRequestSchema
>;

export const GetAgentConversationResponseSchema = z.object({
  conversation: AgentConversationSchema,
  messages: z.array(AgentMessageSchema),
  entries: z.array(AgentConversationEntrySchema).optional(),
});

export type GetAgentConversationResponse = z.infer<
  typeof GetAgentConversationResponseSchema
>;

export const AppendAgentMessageRequestSchema = z.object({
  conversationId: z.string().uuid(),
  role: AgentMessageRoleSchema,
  content: z.string().min(1),
  attachments: z.array(AgentContextAttachmentSchema).optional(),
});

export type AppendAgentMessageRequest = z.infer<
  typeof AppendAgentMessageRequestSchema
>;

export const AppendAgentMessageResponseSchema = z.object({
  message: AgentMessageSchema,
});

export type AppendAgentMessageResponse = z.infer<
  typeof AppendAgentMessageResponseSchema
>;
