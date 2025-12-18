import { z } from 'zod';

/**
 * Workspace schema representing an opened folder.
 * 
 * @remarks
 * A workspace is a single folder opened in the IDE. Multi-root workspaces
 * (multiple folders) are not supported in this spec.
 * 
 * Security: workspace.json contains NO secrets (P3), only path + name.
 */
export const WorkspaceSchema = z.object({
  /** Absolute path to workspace folder */
  path: z.string(),
  
  /** Workspace display name (folder basename) */
  name: z.string(),
});

/**
 * Workspace type inferred from WorkspaceSchema.
 */
export type Workspace = z.infer<typeof WorkspaceSchema>;
