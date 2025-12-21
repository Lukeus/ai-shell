import { z } from 'zod';
import { AgentRunStatusSchema } from './agent-runs';
import { ToolCallEnvelopeSchema, ToolCallResultSchema } from './agent-tools';

const AgentEventBaseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export const AgentLogLevelSchema = z.enum(['info', 'warning', 'error']);

export type AgentLogLevel = z.infer<typeof AgentLogLevelSchema>;

export const AgentPlanStepStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export type AgentPlanStepStatus = z.infer<typeof AgentPlanStepStatusSchema>;

export const AgentStatusEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('status'),
  status: AgentRunStatusSchema,
});

export const AgentPlanStepEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('plan-step'),
  stepId: z.string(),
  title: z.string(),
  status: AgentPlanStepStatusSchema,
});

const AgentPlanStepSchema = z.object({
  stepId: z.string(),
  title: z.string(),
  status: AgentPlanStepStatusSchema.optional(),
});

export const AgentPlanEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('plan'),
  steps: z.array(AgentPlanStepSchema),
});

export const AgentTodoUpdateEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('todo-update'),
  todoId: z.string(),
  title: z.string(),
  status: AgentPlanStepStatusSchema,
});

export const AgentToolCallEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('tool-call'),
  toolCall: ToolCallEnvelopeSchema,
});

export const AgentToolResultEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('tool-result'),
  result: ToolCallResultSchema,
});

export const AgentLogEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('log'),
  level: AgentLogLevelSchema,
  message: z.string(),
});

export const AgentErrorEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
});

export const AgentEventSchema = z.discriminatedUnion('type', [
  AgentStatusEventSchema,
  AgentPlanEventSchema,
  AgentPlanStepEventSchema,
  AgentTodoUpdateEventSchema,
  AgentToolCallEventSchema,
  AgentToolResultEventSchema,
  AgentLogEventSchema,
  AgentErrorEventSchema,
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const AgentEventSubscriptionRequestSchema = z.object({
  runId: z.string().uuid().optional(),
  cursor: z.string().optional(),
});

export type AgentEventSubscriptionRequest = z.infer<typeof AgentEventSubscriptionRequestSchema>;

export const ListAgentTraceRequestSchema = z.object({
  runId: z.string().uuid(),
  limit: z.number().int().min(1).max(500).optional(),
  cursor: z.string().optional(),
});

export type ListAgentTraceRequest = z.infer<typeof ListAgentTraceRequestSchema>;

export const ListAgentTraceResponseSchema = z.object({
  events: z.array(AgentEventSchema),
  nextCursor: z.string().optional(),
});

export type ListAgentTraceResponse = z.infer<typeof ListAgentTraceResponseSchema>;
