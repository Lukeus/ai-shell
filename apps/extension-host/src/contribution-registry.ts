/**
 * ContributionRegistry - Tracks extension contributions (commands, views, tools, etc.).
 * 
 * Extensions declare contribution points in their manifest.
 * This registry aggregates all contributions for lookup and execution.
 */

import type { ConnectionProvider, ExtensionManifest } from 'packages-api-contracts';

/**
 * Command contribution from an extension.
 */
export interface CommandContribution {
  id: string;
  title: string;
  category?: string;
  when?: string;
  extensionId: string;
}

/**
 * View contribution from an extension.
 */
export interface ViewContribution {
  id: string;
  name: string;
  location: 'primary-sidebar' | 'secondary-sidebar' | 'panel';
  icon?: string;
  when?: string;
  extensionId: string;
}

/**
 * Tool contribution from an extension.
 */
export interface ToolContribution {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  extensionId: string;
}

/**
 * Setting contribution from an extension.
 */
export interface SettingContribution {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  default?: unknown;
  description?: string;
  enum?: string[];
  extensionId: string;
}

/**
 * Connection provider contribution from an extension.
 */
export type ConnectionProviderContribution = ConnectionProvider & {
  extensionId: string;
};

/**
 * ContributionRegistry tracks all contributions from extensions.
 */
export class ContributionRegistry {
  private commands = new Map<string, CommandContribution>();
  private views = new Map<string, ViewContribution>();
  private tools = new Map<string, ToolContribution>();
  private settings = new Map<string, SettingContribution>();
  private connectionProviders = new Map<string, ConnectionProviderContribution>();

  /**
   * Register contributions from an extension manifest.
   * 
   * @param manifest - Extension manifest
   */
  registerContributions(manifest: ExtensionManifest): void {
    const extensionId = manifest.id;

    if (!manifest.contributes) {
      return;
    }

    // Register commands
    if (manifest.contributes.commands) {
      for (const cmd of manifest.contributes.commands) {
        this.commands.set(cmd.id, {
          ...cmd,
          extensionId,
        });
      }
      console.log(`[ContributionRegistry] Registered ${manifest.contributes.commands.length} commands from ${extensionId}`);
    }

    // Register views
    if (manifest.contributes.views) {
      for (const view of manifest.contributes.views) {
        this.views.set(view.id, {
          ...view,
          extensionId,
        });
      }
      console.log(`[ContributionRegistry] Registered ${manifest.contributes.views.length} views from ${extensionId}`);
    }

    // Register tools
    if (manifest.contributes.tools) {
      for (const tool of manifest.contributes.tools) {
        this.tools.set(tool.name, {
          ...tool,
          extensionId,
        });
      }
      console.log(`[ContributionRegistry] Registered ${manifest.contributes.tools.length} tools from ${extensionId}`);
    }

    // Register settings
    if (manifest.contributes.settings) {
      for (const setting of manifest.contributes.settings) {
        this.settings.set(setting.key, {
          ...setting,
          extensionId,
        });
      }
      console.log(`[ContributionRegistry] Registered ${manifest.contributes.settings.length} settings from ${extensionId}`);
    }

    // Register connection providers
    if (manifest.contributes.connectionProviders) {
      for (const provider of manifest.contributes.connectionProviders) {
        this.connectionProviders.set(provider.id, {
          ...provider,
          extensionId,
        });
      }
      console.log(`[ContributionRegistry] Registered ${manifest.contributes.connectionProviders.length} connection providers from ${extensionId}`);
    }
  }

  /**
   * Unregister all contributions from an extension.
   * 
   * @param extensionId - Extension ID
   */
  unregisterContributions(extensionId: string): void {
    // Remove commands
    for (const [id, cmd] of this.commands.entries()) {
      if (cmd.extensionId === extensionId) {
        this.commands.delete(id);
      }
    }

    // Remove views
    for (const [id, view] of this.views.entries()) {
      if (view.extensionId === extensionId) {
        this.views.delete(id);
      }
    }

    // Remove tools
    for (const [name, tool] of this.tools.entries()) {
      if (tool.extensionId === extensionId) {
        this.tools.delete(name);
      }
    }

    // Remove settings
    for (const [key, setting] of this.settings.entries()) {
      if (setting.extensionId === extensionId) {
        this.settings.delete(key);
      }
    }

    // Remove connection providers
    for (const [id, provider] of this.connectionProviders.entries()) {
      if (provider.extensionId === extensionId) {
        this.connectionProviders.delete(id);
      }
    }

    console.log(`[ContributionRegistry] Unregistered all contributions from ${extensionId}`);
  }

  /**
   * Get all registered commands.
   */
  getAllCommands(): CommandContribution[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by ID.
   */
  getCommand(commandId: string): CommandContribution | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Get all registered views.
   */
  getAllViews(): ViewContribution[] {
    return Array.from(this.views.values());
  }

  /**
   * Get view by ID.
   */
  getView(viewId: string): ViewContribution | undefined {
    return this.views.get(viewId);
  }

  /**
   * Get all registered tools.
   */
  getAllTools(): ToolContribution[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name.
   */
  getTool(toolName: string): ToolContribution | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all registered settings.
   */
  getAllSettings(): SettingContribution[] {
    return Array.from(this.settings.values());
  }

  /**
   * Get setting by key.
   */
  getSetting(settingKey: string): SettingContribution | undefined {
    return this.settings.get(settingKey);
  }

  /**
   * Get all registered connection providers.
   */
  getAllConnectionProviders(): ConnectionProviderContribution[] {
    return Array.from(this.connectionProviders.values());
  }

  /**
   * Get connection provider by ID.
   */
  getConnectionProvider(providerId: string): ConnectionProviderContribution | undefined {
    return this.connectionProviders.get(providerId);
  }
}
