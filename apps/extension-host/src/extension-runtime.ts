/**
 * ExtensionRuntime - Extension API surface wrapper.
 * 
 * This is the API object that extensions receive in their activate() function.
 * Provides controlled access to platform capabilities.
 * 
 * P1 (Process Isolation): Extensions only access curated APIs (commands/views/tools registration).
 * NO direct filesystem, network, or OS access.
 */

import type { ExtensionAPI, ExtensionContext } from 'packages-api-contracts';
import { CommandManager } from './command-manager';
import { ViewManager } from './view-manager';
import { ToolManager } from './tool-manager';

/**
 * ExtensionRuntime creates the API object for an extension.
 */
export class ExtensionRuntime {
  private commandManager: CommandManager;
  private viewManager: ViewManager;
  private toolManager: ToolManager;

  constructor(
    commandManager: CommandManager,
    viewManager: ViewManager,
    toolManager: ToolManager
  ) {
    this.commandManager = commandManager;
    this.viewManager = viewManager;
    this.toolManager = toolManager;
  }

  /**
   * Create Extension API object for an extension.
   * This is passed to the extension's activate() function.
   * 
   * @param context - Extension context
   * @returns Extension API object
   */
  createAPI(context: ExtensionContext): ExtensionAPI {
    const api: ExtensionAPI = {
      context,

      log(message: string): void {
        console.log(`[Extension ${context.extensionId}] ${message}`);
      },

      commands: {
        registerCommand: (commandId, handler) => {
          this.commandManager.registerCommand(commandId, handler, context.extensionId);
        },
      },

      views: {
        registerView: (viewId, provider) => {
          this.viewManager.registerView(viewId, provider, context.extensionId);
        },
      },

      tools: {
        registerTool: (name, description, inputSchema, handler) => {
          this.toolManager.registerTool(
            name,
            description,
            inputSchema,
            handler,
            context.extensionId
          );
        },
      },
    };

    return api;
  }
}
