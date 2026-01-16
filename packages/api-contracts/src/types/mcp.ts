import { z } from 'zod';
import { JsonValueSchema } from './agent-tools';

/**
 * MCP transport types supported by the platform.
 * v1 supports stdio only.
 */
export const McpTransportSchema = z.enum(['stdio']);

export type McpTransport = z.infer<typeof McpTransportSchema>;

/**
 * Environment variable mapping for MCP server processes.
 * Values are sourced from connection config or the stored secret.
 */
export const McpServerEnvSourceSchema = z.object({
  source: z.enum(['config', 'secret']),
  key: z.string().min(1).optional(),
});

export type McpServerEnvSource = z.infer<typeof McpServerEnvSourceSchema>;

export const McpServerEnvMappingSchema = z.record(z.string().min(1), McpServerEnvSourceSchema);

export type McpServerEnvMapping = z.infer<typeof McpServerEnvMappingSchema>;

/**
 * MCP server contribution from an extension manifest.
 */
export const McpServerContributionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: McpTransportSchema,
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: McpServerEnvMappingSchema.optional(),
  connectionProviderId: z.string().min(1).optional(),
});

export type McpServerContribution = z.infer<typeof McpServerContributionSchema>;

export const McpServerRefSchema = z.object({
  extensionId: z.string().min(1),
  serverId: z.string().min(1),
});

export type McpServerRef = z.infer<typeof McpServerRefSchema>;

export const McpServerStateSchema = z.enum([
  'stopped',
  'starting',
  'running',
  'stopping',
  'failed',
]);

export type McpServerState = z.infer<typeof McpServerStateSchema>;

export const McpServerStatusSchema = McpServerRefSchema.extend({
  state: McpServerStateSchema,
  message: z.string().optional(),
  updatedAt: z.string().datetime(),
});

export type McpServerStatus = z.infer<typeof McpServerStatusSchema>;

export const McpServerListItemSchema = McpServerRefSchema.extend({
  name: z.string().min(1),
  transport: McpTransportSchema,
  connectionProviderId: z.string().min(1).optional(),
  enabled: z.boolean(),
  status: McpServerStatusSchema,
});

export type McpServerListItem = z.infer<typeof McpServerListItemSchema>;

export const McpListServersResponseSchema = z.object({
  servers: z.array(McpServerListItemSchema),
});

export type McpListServersResponse = z.infer<typeof McpListServersResponseSchema>;

export const McpServerStatusRequestSchema = McpServerRefSchema;

export type McpServerStatusRequest = z.infer<typeof McpServerStatusRequestSchema>;

export const McpServerControlRequestSchema = McpServerRefSchema;

export type McpServerControlRequest = z.infer<typeof McpServerControlRequestSchema>;

export const McpToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

export type McpToolDefinition = z.infer<typeof McpToolDefinitionSchema>;

export const McpToolListResponseSchema = z.object({
  server: McpServerRefSchema,
  tools: z.array(McpToolDefinitionSchema),
});

export type McpToolListResponse = z.infer<typeof McpToolListResponseSchema>;

export const McpToolCallSchema = McpServerRefSchema.extend({
  toolName: z.string().min(1),
  input: JsonValueSchema.optional(),
});

export type McpToolCall = z.infer<typeof McpToolCallSchema>;
