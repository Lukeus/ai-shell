import { z } from 'zod';

/**
 * Extension manifest schema.
 * Defines the structure of an extension's package.json manifest.
 */
export const ExtensionManifestSchema = z.object({
  /** Unique identifier for the extension (e.g., "publisher.extension-name") */
  id: z.string().min(1),
  
  /** Extension name */
  name: z.string().min(1),
  
  /** Semantic version (e.g., "1.0.0") */
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  
  /** Publisher/author identifier */
  publisher: z.string().min(1),
  
  /** Human-readable display name (optional) */
  displayName: z.string().optional(),
  
  /** Extension description (optional) */
  description: z.string().optional(),
  
  /** Entry point file path relative to extension root */
  main: z.string().min(1),
  
  /** Activation events that trigger extension loading */
  activationEvents: z.array(z.string()),
  
  /** Required permissions for the extension */
  permissions: z.array(z.enum(['filesystem', 'network', 'secrets', 'ui', 'terminal'])),
  
  /** Contribution points (commands, views, tools, etc.) */
  contributes: z.object({
    commands: z.array(z.object({
      id: z.string(),
      title: z.string(),
      category: z.string().optional(),
      when: z.string().optional(),
    })).optional(),
    
    views: z.array(z.object({
      id: z.string(),
      name: z.string(),
      location: z.enum(['primary-sidebar', 'secondary-sidebar', 'panel']),
      icon: z.string().optional(),
      when: z.string().optional(),
    })).optional(),
    
    settings: z.array(z.object({
      key: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'enum']),
      default: z.unknown(),
      description: z.string().optional(),
      enum: z.array(z.string()).optional(),
    })).optional(),
    
    connectionProviders: z.array(z.object({
      id: z.string(),
      name: z.string(),
      schema: z.record(z.unknown()),
    })).optional(),
    
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown()),
    })).optional(),
  }).optional(),
});

/**
 * TypeScript type inferred from ExtensionManifestSchema.
 */
export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;
