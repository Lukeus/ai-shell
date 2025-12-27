import path from 'path';
import fs from 'fs/promises';
import type { ExtensionContext } from 'packages-api-contracts';
import type { ExtensionRegistry } from './extension-registry';
import type { ExtensionHostManager } from './extension-host-manager';
import type { ExtensionCommandService } from './extension-command-service';
import type { ExtensionViewService } from './extension-view-service';
import type { ExtensionToolService } from './extension-tool-service';
import type { WorkspaceService } from './WorkspaceService';

type ActivationTargets = {
  commands: ExtensionCommandService;
  views: ExtensionViewService;
  tools: ExtensionToolService;
};

export class ExtensionActivationService {
  private readonly extensionRegistry: ExtensionRegistry;
  private readonly extensionHostManager: ExtensionHostManager;
  private readonly workspaceService: WorkspaceService;
  private readonly extensionsDir: string;

  constructor(options: {
    extensionRegistry: ExtensionRegistry;
    extensionHostManager: ExtensionHostManager;
    workspaceService: WorkspaceService;
    extensionsDir: string;
  }) {
    this.extensionRegistry = options.extensionRegistry;
    this.extensionHostManager = options.extensionHostManager;
    this.workspaceService = options.workspaceService;
    this.extensionsDir = options.extensionsDir;
  }

  public async registerEnabledExtensions(): Promise<void> {
    const enabled = this.extensionRegistry.getEnabledExtensions();
    for (const extension of enabled) {
      try {
        await this.extensionHostManager.sendRequest('extension.register', {
          manifest: extension.manifest,
          extensionPath: extension.extensionPath,
        });
      } catch (error) {
        console.error(
          `[ExtensionActivationService] Failed to register ${extension.manifest.id}:`,
          error
        );
      }
    }
  }

  public async syncContributions(targets: ActivationTargets): Promise<void> {
    let commandsResponse: unknown;
    let viewsResponse: unknown;
    let toolsResponse: unknown;
    try {
      commandsResponse = await this.extensionHostManager.sendRequest('contributions.getCommands');
      viewsResponse = await this.extensionHostManager.sendRequest('contributions.getViews');
      toolsResponse = await this.extensionHostManager.sendRequest('contributions.getTools');
    } catch (error) {
      console.error('[ExtensionActivationService] Failed to sync contributions:', error);
      return;
    }

    const commands =
      commandsResponse && typeof commandsResponse === 'object'
        ? (commandsResponse as { commands?: unknown }).commands
        : undefined;
    const views =
      viewsResponse && typeof viewsResponse === 'object'
        ? (viewsResponse as { views?: unknown }).views
        : undefined;
    const tools =
      toolsResponse && typeof toolsResponse === 'object'
        ? (toolsResponse as { tools?: unknown }).tools
        : undefined;

    targets.commands.reset();
    targets.views.reset();
    targets.tools.reset();

    if (Array.isArray(commands)) {
      commands.forEach((cmd) => {
        if (!cmd || typeof cmd !== 'object') {
          return;
        }
        const entry = cmd as {
          id?: unknown;
          title?: unknown;
          category?: unknown;
          extensionId?: unknown;
        };
        if (typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.extensionId !== 'string') {
          return;
        }
        targets.commands.registerCommand({
          commandId: entry.id,
          title: entry.title,
          category: typeof entry.category === 'string' ? entry.category : undefined,
          extensionId: entry.extensionId,
        });
      });
    }

    if (Array.isArray(views)) {
      views.forEach((view) => {
        if (!view || typeof view !== 'object') {
          return;
        }
        const entry = view as {
          id?: unknown;
          name?: unknown;
          location?: unknown;
          icon?: unknown;
          extensionId?: unknown;
        };
        if (
          typeof entry.id !== 'string' ||
          typeof entry.name !== 'string' ||
          typeof entry.location !== 'string' ||
          typeof entry.extensionId !== 'string'
        ) {
          return;
        }
        if (
          entry.location !== 'primary-sidebar' &&
          entry.location !== 'secondary-sidebar' &&
          entry.location !== 'panel'
        ) {
          return;
        }
        targets.views.registerView({
          viewId: entry.id,
          name: entry.name,
          location: entry.location,
          icon: typeof entry.icon === 'string' ? entry.icon : undefined,
          extensionId: entry.extensionId,
        });
      });
    }

    if (Array.isArray(tools)) {
      tools.forEach((tool) => {
        if (!tool || typeof tool !== 'object') {
          return;
        }
        const entry = tool as {
          name?: unknown;
          description?: unknown;
          inputSchema?: unknown;
          outputSchema?: unknown;
          extensionId?: unknown;
        };
        if (
          typeof entry.name !== 'string' ||
          typeof entry.description !== 'string' ||
          typeof entry.extensionId !== 'string' ||
          !entry.inputSchema ||
          typeof entry.inputSchema !== 'object'
        ) {
          return;
        }
        targets.tools.registerTool({
          name: entry.name,
          description: entry.description,
          inputSchema: entry.inputSchema as Record<string, unknown>,
          outputSchema:
            entry.outputSchema && typeof entry.outputSchema === 'object'
              ? (entry.outputSchema as Record<string, unknown>)
              : undefined,
          extensionId: entry.extensionId,
        });
      });
    }
  }

  public async activateStartupExtensions(): Promise<void> {
    const enabled = this.extensionRegistry.getEnabledExtensions();
    for (const extension of enabled) {
      if (this.matchesActivationEvent(extension.manifest.activationEvents, 'onStartup')) {
        await this.activateExtension(extension.manifest.id);
      }
    }
  }

  public async ensureActivated(
    extensionId: string,
    event?: string
  ): Promise<void> {
    const extension = this.extensionRegistry.getExtension(extensionId);
    if (!extension || !extension.enabled) {
      return;
    }

    const events = extension.manifest.activationEvents ?? [];
    const shouldActivate = event
      ? this.matchesActivationEvent(events, event)
      : true;

    if (!shouldActivate && event) {
      console.warn(
        `[ExtensionActivationService] Activation event "${event}" not declared by ${extensionId}; activating anyway.`
      );
    }

    await this.activateExtension(extensionId);
  }

  private matchesActivationEvent(events: string[], event: string): boolean {
    return events.some((activationEvent) => {
      if (activationEvent === event) {
        return true;
      }
      if (event.startsWith(`${activationEvent}:`)) {
        return true;
      }
      return false;
    });
  }

  private async activateExtension(extensionId: string): Promise<void> {
    const extension = this.extensionRegistry.getExtension(extensionId);
    if (!extension) {
      return;
    }

    const context = await this.buildContext(extensionId, extension.extensionPath);
    await this.extensionHostManager.sendRequest('extension.activate', {
      extensionId,
      context,
    });
  }

  private async buildContext(
    extensionId: string,
    extensionPath: string
  ): Promise<ExtensionContext> {
    const globalStoragePath = path.join(
      this.extensionsDir,
      extensionId,
      'storage'
    );
    await fs.mkdir(globalStoragePath, { recursive: true });

    const workspace = this.workspaceService.getWorkspace();
    const workspaceStoragePath = workspace
      ? path.join(workspace.path, '.ai-shell', 'extensions', extensionId)
      : undefined;

    if (workspaceStoragePath) {
      await fs.mkdir(workspaceStoragePath, { recursive: true });
    }

    return {
      extensionId,
      extensionPath,
      globalStoragePath,
      workspaceStoragePath,
    };
  }
}
