import { z } from 'zod';
import { JsonValueSchema } from './agent-tools';

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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentRunMetadata = z.infer<typeof AgentRunMetadataSchema>;

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
  inputs: z.record(JsonValueSchema).optional(),
  toolAllowlist: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
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
