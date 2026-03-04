import { z } from 'zod';
import { JsonValueSchema } from './agent-tools';
import {
  AgentSkillIdSchema,
  AgentSubagentDefinitionSchema,
  AgentSkillSourceSchema,
  SkillScopeSchema,
} from './agent-skills';

export const AgentRunStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'canceled',
]);

export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSourceSchema = z.enum(['user', 'extension', 'system']);

export type AgentRunSource = z.infer<typeof AgentRunSourceSchema>;

export const AgentRunMetadataSchema = z.object({
  id: z.string().uuid(),
  status: AgentRunStatusSchema,
  source: AgentRunSourceSchema,
  routing: z
    .object({
      connectionId: z.string().uuid(),
      providerId: z.string(),
      modelRef: z.string().optional(),
    })
    .optional(),
  skill: z
    .object({
      skillId: AgentSkillIdSchema,
      source: AgentSkillSourceSchema,
      scope: SkillScopeSchema,
      version: z.number().int().min(1).optional(),
    })
    .optional(),
  delegation: z
    .object({
      enabled: z.boolean(),
      maxDepth: z.number().int().min(1).optional(),
      maxDelegations: z.number().int().min(1).optional(),
      subagentSkillIds: z.array(AgentSkillIdSchema),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentRunMetadata = z.infer<typeof AgentRunMetadataSchema>;

export const AgentMemoryConfigSchema = z.object({
  maxEntries: z.number().int().min(1).optional(),
  maxBytes: z.number().int().min(1).optional(),
});

export type AgentMemoryConfig = z.infer<typeof AgentMemoryConfigSchema>;

export const AgentPolicyConfigSchema = z.object({
  allowlist: z.array(z.string()).optional(),
  denylist: z.array(z.string()).optional(),
});

export type AgentPolicyConfig = z.infer<typeof AgentPolicyConfigSchema>;

export const AgentRunDelegationConfigSchema = z.object({
  enabled: z.boolean(),
  maxDepth: z.number().int().min(1).optional(),
  maxDelegations: z.number().int().min(1).optional(),
  subagents: z.array(AgentSubagentDefinitionSchema),
});

export type AgentRunDelegationConfig = z.infer<typeof AgentRunDelegationConfigSchema>;

export const DeepAgentRunConfigSchema = z.object({
  modelRef: z.string().optional(),
  toolAllowlist: z.array(z.string()).optional(),
  memory: AgentMemoryConfigSchema.optional(),
  policy: AgentPolicyConfigSchema.optional(),
  delegation: AgentRunDelegationConfigSchema.optional(),
  mounts: z
    .array(
      z.object({
        name: z.string(),
        path: z.string(),
        readOnly: z.boolean().optional(),
      })
    )
    .optional(),
  budgets: z
    .object({
      maxSteps: z.number().int().min(1).optional(),
      maxToolCalls: z.number().int().min(1).optional(),
      maxWallclockMs: z.number().int().min(1).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type DeepAgentRunConfig = z.infer<typeof DeepAgentRunConfigSchema>;

export const ListAgentRunsRequestSchema = z.object({});

export type ListAgentRunsRequest = z.infer<typeof ListAgentRunsRequestSchema>;

export const ListAgentRunsResponseSchema = z.object({
  runs: z.array(AgentRunMetadataSchema),
});

export type ListAgentRunsResponse = z.infer<typeof ListAgentRunsResponseSchema>;

export const GetAgentRunRequestSchema = z.object({
  runId: z.string().uuid(),
});

export type GetAgentRunRequest = z.infer<typeof GetAgentRunRequestSchema>;

export const GetAgentRunResponseSchema = z.object({
  run: AgentRunMetadataSchema,
});

export type GetAgentRunResponse = z.infer<typeof GetAgentRunResponseSchema>;

export const AgentRunStartRequestSchema = z.object({
  goal: z.string().min(1),
  connectionId: z.string().uuid().optional(),
  skillId: AgentSkillIdSchema.optional(),
  inputs: z.record(z.string(), JsonValueSchema).optional(),
  toolAllowlist: z.array(z.string()).optional(),
  config: DeepAgentRunConfigSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type AgentRunStartRequest = z.infer<typeof AgentRunStartRequestSchema>;

export const AgentRunStartResponseSchema = z.object({
  run: AgentRunMetadataSchema,
});

export type AgentRunStartResponse = z.infer<typeof AgentRunStartResponseSchema>;

export const AgentRunControlActionSchema = z.enum(['cancel', 'retry']);

export type AgentRunControlAction = z.infer<typeof AgentRunControlActionSchema>;

export const AgentRunControlRequestSchema = z.object({
  runId: z.string().uuid(),
  action: AgentRunControlActionSchema,
  reason: z.string().optional(),
});

export type AgentRunControlRequest = z.infer<typeof AgentRunControlRequestSchema>;

export const AgentRunControlResponseSchema = z.object({
  run: AgentRunMetadataSchema,
});

export type AgentRunControlResponse = z.infer<typeof AgentRunControlResponseSchema>;
