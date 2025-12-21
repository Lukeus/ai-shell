import { z } from 'zod';

/**
 * Extension state enum.
 * Represents the lifecycle state of an extension.
 */
export const ExtensionStateSchema = z.enum([
  'inactive',
  'activating',
  'active',
  'failed',
  'deactivating',
]);

/**
 * TypeScript type for extension state.
 */
export type ExtensionState = z.infer<typeof ExtensionStateSchema>;

/**
 * Extension state change event schema.
 * Emitted when an extension transitions between states.
 */
export const ExtensionStateChangeEventSchema = z.object({
  /** Extension identifier */
  extensionId: z.string(),
  
  /** New state */
  state: ExtensionStateSchema,
  
  /** Timestamp of state change (milliseconds since epoch) */
  timestamp: z.number(),
  
  /** Error message if state is 'failed' */
  error: z.string().optional(),
});

/**
 * TypeScript type for extension state change event.
 */
export type ExtensionStateChangeEvent = z.infer<typeof ExtensionStateChangeEventSchema>;
