import { z } from 'zod';

export const ConnectionScopeSchema = z.enum(['user', 'workspace']);

export type ConnectionScope = z.infer<typeof ConnectionScopeSchema>;

export const ConnectionFieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'secret',
  'select',
]);

export type ConnectionFieldType = z.infer<typeof ConnectionFieldTypeSchema>;

export const ConnectionFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
});

export type ConnectionFieldOption = z.infer<typeof ConnectionFieldOptionSchema>;

export const ConnectionFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: ConnectionFieldTypeSchema,
  required: z.boolean().default(false),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(ConnectionFieldOptionSchema).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export type ConnectionField = z.infer<typeof ConnectionFieldSchema>;

export const ConnectionProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  fields: z.array(ConnectionFieldSchema),
});

export type ConnectionProvider = z.infer<typeof ConnectionProviderSchema>;

export const ProviderDescriptorSchema = ConnectionProviderSchema;

export type ProviderDescriptor = ConnectionProvider;

export const ConnectionConfigSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
);

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const ConnectionMetadataSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  scope: ConnectionScopeSchema,
  displayName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  secretRef: z.string().optional(),
});

export type ConnectionMetadata = z.infer<typeof ConnectionMetadataSchema>;

export const ConnectionSchema = z.object({
  metadata: ConnectionMetadataSchema,
  config: ConnectionConfigSchema,
});

export type Connection = z.infer<typeof ConnectionSchema>;

export const CreateConnectionRequestSchema = z.object({
  providerId: z.string(),
  scope: ConnectionScopeSchema,
  displayName: z.string(),
  config: ConnectionConfigSchema,
});

export type CreateConnectionRequest = z.infer<typeof CreateConnectionRequestSchema>;

export const CreateConnectionResponseSchema = z.object({
  connection: ConnectionSchema,
});

export type CreateConnectionResponse = z.infer<typeof CreateConnectionResponseSchema>;

export const UpdateConnectionRequestSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().optional(),
  config: ConnectionConfigSchema.optional(),
});

export type UpdateConnectionRequest = z.infer<typeof UpdateConnectionRequestSchema>;

export const UpdateConnectionResponseSchema = z.object({
  connection: ConnectionSchema,
});

export type UpdateConnectionResponse = z.infer<typeof UpdateConnectionResponseSchema>;

export const DeleteConnectionRequestSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteConnectionRequest = z.infer<typeof DeleteConnectionRequestSchema>;

export const ListConnectionsResponseSchema = z.object({
  connections: z.array(ConnectionSchema),
});

export type ListConnectionsResponse = z.infer<typeof ListConnectionsResponseSchema>;

export const ListProvidersResponseSchema = z.object({
  providers: z.array(ProviderDescriptorSchema),
});

export type ListProvidersResponse = z.infer<typeof ListProvidersResponseSchema>;
