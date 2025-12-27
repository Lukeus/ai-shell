import { z } from 'zod';

/**
 * Permission scope enum.
 * Defines granular permission scopes for extensions.
 */
export const PermissionScopeSchema = z.enum([
  'filesystem.read',
  'filesystem.write',
  'network.http',
  'network.websocket',
  'secrets.read',
  'secrets.write',
  'ui.showMessage',
  'ui.showInput',
  'terminal.create',
  'terminal.write',
]);

/**
 * TypeScript type for permission scope.
 */
export type PermissionScope = z.infer<typeof PermissionScopeSchema>;

/**
 * Permission request schema.
 * Used when an extension requests a permission at runtime.
 */
export const PermissionRequestSchema = z.object({
  /** Extension requesting the permission */
  extensionId: z.string(),
  
  /** Permission scope being requested */
  scope: PermissionScopeSchema,
  
  /** Optional reason/justification for the permission */
  reason: z.string().optional(),
});

/**
 * TypeScript type for permission request.
 */
export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

/**
 * Permission grant schema.
 * Records a granted or denied permission.
 */
export const PermissionGrantSchema = z.object({
  /** Extension the permission applies to */
  extensionId: z.string(),
  
  /** Permission scope */
  scope: PermissionScopeSchema,
  
  /** Whether permission was granted (true) or denied (false) */
  granted: z.boolean(),
  
  /** Timestamp when permission was granted/denied */
  timestamp: z.number(),
  
  /** Whether this was an explicit user decision (true) or auto-granted (false) */
  userDecision: z.boolean(),
});

/**
 * TypeScript type for permission grant.
 */
export type PermissionGrant = z.infer<typeof PermissionGrantSchema>;

/**
 * Permission check result returned to renderer.
 */
export const PermissionCheckResultSchema = z.object({
  granted: z.boolean(),
  reason: z.string().optional(),
});

export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;
