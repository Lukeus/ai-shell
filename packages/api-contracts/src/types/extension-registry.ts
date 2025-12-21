import { z } from 'zod';
import { ExtensionManifestSchema } from './extension-manifest';

/**
 * Extension registry item exposed to renderer.
 * Contains manifest and install metadata, omitting filesystem paths.
 */
export const ExtensionRegistryItemSchema = z.object({
  manifest: ExtensionManifestSchema,
  enabled: z.boolean(),
  installedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExtensionRegistryItem = z.infer<typeof ExtensionRegistryItemSchema>;

export const ListExtensionsResponseSchema = z.object({
  extensions: z.array(ExtensionRegistryItemSchema),
});

export type ListExtensionsResponse = z.infer<typeof ListExtensionsResponseSchema>;

export const ExtensionIdRequestSchema = z.object({
  extensionId: z.string().min(1),
});

export type ExtensionIdRequest = z.infer<typeof ExtensionIdRequestSchema>;
