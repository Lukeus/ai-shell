import { z } from 'zod';

/**
 * Command contribution schema.
 * Defines a command contributed by an extension.
 */
export const CommandContributionSchema = z.object({
  /** Unique command identifier (e.g., "extension.commandName") */
  id: z.string(),
  
  /** Human-readable command title */
  title: z.string(),
  
  /** Optional category for grouping in command palette */
  category: z.string().optional(),
  
  /** Optional when-clause for conditional visibility */
  when: z.string().optional(),
});

/**
 * TypeScript type for command contribution.
 */
export type CommandContribution = z.infer<typeof CommandContributionSchema>;

/**
 * View contribution schema.
 * Defines a view panel contributed by an extension.
 */
export const ViewContributionSchema = z.object({
  /** Unique view identifier */
  id: z.string(),
  
  /** Human-readable view name */
  name: z.string(),
  
  /** Location where view should appear */
  location: z.enum(['primary-sidebar', 'secondary-sidebar', 'panel']),
  
  /** Optional icon identifier */
  icon: z.string().optional(),
  
  /** Optional when-clause for conditional visibility */
  when: z.string().optional(),
});

/**
 * TypeScript type for view contribution.
 */
export type ViewContribution = z.infer<typeof ViewContributionSchema>;

/**
 * Tool contribution schema.
 * Defines a tool contributed by an extension for agent use.
 */
export const ToolContributionSchema = z.object({
  /** Tool name (unique within extension) */
  name: z.string(),
  
  /** Tool description for agent context */
  description: z.string(),
  
  /** JSON Schema for tool input parameters */
  inputSchema: z.record(z.unknown()),

  /** Optional JSON Schema for tool output */
  outputSchema: z.record(z.unknown()).optional(),
});

/**
 * TypeScript type for tool contribution.
 */
export type ToolContribution = z.infer<typeof ToolContributionSchema>;

/**
 * Setting contribution schema.
 * Defines a configuration setting contributed by an extension.
 */
export const SettingContributionSchema = z.object({
  /** Setting key (e.g., "extension.setting.name") */
  key: z.string(),
  
  /** Setting type */
  type: z.enum(['string', 'number', 'boolean', 'enum']),
  
  /** Default value */
  default: z.unknown(),
  
  /** Optional description */
  description: z.string().optional(),
  
  /** Enum values (required if type is 'enum') */
  enum: z.array(z.string()).optional(),
});

/**
 * TypeScript type for setting contribution.
 */
export type SettingContribution = z.infer<typeof SettingContributionSchema>;
