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

export type ExtensionCommandHandler = (...args: unknown[]) => unknown | Promise<unknown>;
export type ExtensionViewProvider = () => string | Promise<string>;
export type ExtensionToolHandler = (input: unknown) => unknown | Promise<unknown>;

export interface ExtensionAPI {
  readonly context: ExtensionContext;
  log(message: string): void;
  commands: {
    registerCommand(commandId: string, handler: ExtensionCommandHandler): void;
  };
  views: {
    registerView(viewId: string, provider: ExtensionViewProvider): void;
  };
  tools: {
    registerTool(
      name: string,
      description: string,
      inputSchema: Record<string, unknown>,
      handler: ExtensionToolHandler
    ): void;
  };
}
