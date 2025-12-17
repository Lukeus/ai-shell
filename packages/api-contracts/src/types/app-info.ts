import { z } from 'zod';

/**
 * Zod schema for application version information.
 * Used to validate version data passed between main and renderer processes.
 */
export const AppInfoSchema = z.object({
  version: z.string(),
  electronVersion: z.string(),
  chromeVersion: z.string(),
  nodeVersion: z.string(),
});

/**
 * TypeScript type inferred from AppInfoSchema.
 * Contains version information about the application and its runtime.
 */
export type AppInfo = z.infer<typeof AppInfoSchema>;
