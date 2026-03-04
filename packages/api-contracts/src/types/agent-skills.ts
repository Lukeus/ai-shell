import { z } from 'zod';

export const SkillScopeSchema = z.enum(['global', 'workspace']);

export type SkillScope = z.infer<typeof SkillScopeSchema>;

export const AgentSkillIdSchema = z.string().min(1);

export type AgentSkillId = z.infer<typeof AgentSkillIdSchema>;

export const AgentSkillInputSchema = z.record(z.string(), z.unknown());

export type AgentSkillInput = z.infer<typeof AgentSkillInputSchema>;

export const AgentSubagentDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  skillId: AgentSkillIdSchema,
  enabled: z.boolean().optional(),
  toolAllowlist: z.array(z.string().min(1)).optional(),
  toolDenylist: z.array(z.string().min(1)).optional(),
});

export type AgentSubagentDefinition = z.infer<typeof AgentSubagentDefinitionSchema>;

export const AgentSkillDelegationSchema = z.object({
  enabled: z.boolean(),
  maxDepth: z.number().int().min(1).optional(),
  maxDelegations: z.number().int().min(1).optional(),
  subagents: z.array(AgentSubagentDefinitionSchema).min(1),
});

export type AgentSkillDelegation = z.infer<typeof AgentSkillDelegationSchema>;

export const AgentSkillDefinitionSchema = z.object({
  id: AgentSkillIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  promptTemplate: z.string().optional(),
  toolAllowlist: z.array(z.string().min(1)).optional(),
  toolDenylist: z.array(z.string().min(1)).optional(),
  delegation: AgentSkillDelegationSchema.optional(),
  inputSchema: AgentSkillInputSchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export type AgentSkillDefinition = z.infer<typeof AgentSkillDefinitionSchema>;

export const AgentSkillSourceSchema = z.enum(['user', 'extension']);

export type AgentSkillSource = z.infer<typeof AgentSkillSourceSchema>;

export const AgentSkillDescriptorSchema = z.object({
  definition: AgentSkillDefinitionSchema,
  source: AgentSkillSourceSchema,
  scope: SkillScopeSchema,
  enabled: z.boolean(),
  version: z.number().int().min(1).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  extensionId: z.string().optional(),
});

export type AgentSkillDescriptor = z.infer<typeof AgentSkillDescriptorSchema>;

export const SkillPreferencesSchema = z.object({
  defaultSkillId: AgentSkillIdSchema.nullable().default(null),
  lastUsedSkillId: AgentSkillIdSchema.nullable().default(null),
});

export type SkillPreferences = z.infer<typeof SkillPreferencesSchema>;

export const ListAgentSkillsRequestSchema = z.object({
  scope: SkillScopeSchema.optional(),
});

export type ListAgentSkillsRequest = z.infer<typeof ListAgentSkillsRequestSchema>;

export const ListAgentSkillsResponseSchema = z.object({
  skills: z.array(AgentSkillDescriptorSchema),
  preferences: SkillPreferencesSchema.optional(),
});

export type ListAgentSkillsResponse = z.infer<typeof ListAgentSkillsResponseSchema>;

export const GetAgentSkillRequestSchema = z.object({
  id: AgentSkillIdSchema,
  scope: SkillScopeSchema.optional(),
});

export type GetAgentSkillRequest = z.infer<typeof GetAgentSkillRequestSchema>;

export const GetAgentSkillResponseSchema = z.object({
  skill: AgentSkillDescriptorSchema,
});

export type GetAgentSkillResponse = z.infer<typeof GetAgentSkillResponseSchema>;

export const CreateAgentSkillRequestSchema = z.object({
  scope: SkillScopeSchema,
  skill: AgentSkillDefinitionSchema,
});

export type CreateAgentSkillRequest = z.infer<typeof CreateAgentSkillRequestSchema>;

export const CreateAgentSkillResponseSchema = z.object({
  skill: AgentSkillDescriptorSchema,
});

export type CreateAgentSkillResponse = z.infer<typeof CreateAgentSkillResponseSchema>;

export const UpdateAgentSkillRequestSchema = z.object({
  id: AgentSkillIdSchema,
  scope: SkillScopeSchema,
  updates: AgentSkillDefinitionSchema.partial(),
});

export type UpdateAgentSkillRequest = z.infer<typeof UpdateAgentSkillRequestSchema>;

export const UpdateAgentSkillResponseSchema = z.object({
  skill: AgentSkillDescriptorSchema,
});

export type UpdateAgentSkillResponse = z.infer<typeof UpdateAgentSkillResponseSchema>;

export const DeleteAgentSkillRequestSchema = z.object({
  id: AgentSkillIdSchema,
  scope: SkillScopeSchema,
});

export type DeleteAgentSkillRequest = z.infer<typeof DeleteAgentSkillRequestSchema>;

export const DeleteAgentSkillResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteAgentSkillResponse = z.infer<typeof DeleteAgentSkillResponseSchema>;

export const SetAgentSkillEnabledRequestSchema = z.object({
  id: AgentSkillIdSchema,
  scope: SkillScopeSchema,
  enabled: z.boolean(),
});

export type SetAgentSkillEnabledRequest = z.infer<typeof SetAgentSkillEnabledRequestSchema>;

export const SetAgentSkillEnabledResponseSchema = z.object({
  skill: AgentSkillDescriptorSchema,
});

export type SetAgentSkillEnabledResponse = z.infer<typeof SetAgentSkillEnabledResponseSchema>;

export const SetDefaultSkillRequestSchema = z.object({
  scope: SkillScopeSchema,
  skillId: AgentSkillIdSchema.nullable(),
});

export type SetDefaultSkillRequest = z.infer<typeof SetDefaultSkillRequestSchema>;

export const SetDefaultSkillResponseSchema = z.object({
  preferences: SkillPreferencesSchema,
});

export type SetDefaultSkillResponse = z.infer<typeof SetDefaultSkillResponseSchema>;

export const SetLastUsedSkillRequestSchema = z.object({
  scope: SkillScopeSchema,
  skillId: AgentSkillIdSchema.nullable(),
});

export type SetLastUsedSkillRequest = z.infer<typeof SetLastUsedSkillRequestSchema>;

export const SetLastUsedSkillResponseSchema = z.object({
  preferences: SkillPreferencesSchema,
});

export type SetLastUsedSkillResponse = z.infer<typeof SetLastUsedSkillResponseSchema>;
