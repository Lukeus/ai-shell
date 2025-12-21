import { z } from 'zod';

/**
 * Extension context schema.
 * Provides context information to an extension during activation.
 */
export const ExtensionContextSchema = z.object({
  /** Unique extension identifier */
  extensionId: z.string(),
  
  /** Absolute path to extension directory */
  extensionPath: z.string(),
  
  /** Absolute path to global storage directory for this extension */
  globalStoragePath: z.string(),
  
  /** Absolute path to workspace storage directory (if workspace is open) */
  workspaceStoragePath: z.string().optional(),
});

/**
 * TypeScript type for extension context.
 */
export type ExtensionContext = z.infer<typeof ExtensionContextSchema>;
