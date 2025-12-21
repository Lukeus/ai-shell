/**
 * ExtensionCommandService - Routes command execution to Extension Host.
 * 
 * P1 (Process isolation): Commands execute in Extension Host, not main process.
 * P2 (Security): Renderer communicates via IPC only, never directly to Extension Host.
 */

import { ExtensionHostManager } from './extension-host-manager';

/**
 * Command execution timeout (5 seconds).
 */
const COMMAND_TIMEOUT_MS = 5000;

/**
 * Command execution result.
 */
export interface CommandExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Registered command metadata.
 */
export interface RegisteredCommand {
  commandId: string;
  title: string;
  category?: string;
  extensionId: string;
}

/**
 * ExtensionCommandService manages command registration and execution.
 */
export class ExtensionCommandService {
  private extensionHostManager: ExtensionHostManager;
  private commands: Map<string, RegisteredCommand>;

  constructor(extensionHostManager: ExtensionHostManager) {
    this.extensionHostManager = extensionHostManager;
    this.commands = new Map();
  }

  /**
   * Register a command from an extension.
   * Called by ExtensionHostManager when extensions register commands.
   */
  registerCommand(command: RegisteredCommand): void {
    if (this.commands.has(command.commandId)) {
      console.warn(`[ExtensionCommandService] Command ${command.commandId} already registered, overwriting`);
    }

    this.commands.set(command.commandId, command);
    console.log(`[ExtensionCommandService] Registered command ${command.commandId} from ${command.extensionId}`);
  }

  /**
   * Unregister commands from an extension.
   */
  unregisterExtensionCommands(extensionId: string): void {
    const toRemove: string[] = [];
    
    for (const [commandId, command] of this.commands.entries()) {
      if (command.extensionId === extensionId) {
        toRemove.push(commandId);
      }
    }

    for (const commandId of toRemove) {
      this.commands.delete(commandId);
    }

    if (toRemove.length > 0) {
      console.log(`[ExtensionCommandService] Unregistered ${toRemove.length} commands from ${extensionId}`);
    }
  }

  /**
   * Execute a command by ID.
   * Routes execution to Extension Host via JSON-RPC.
   * 
   * @param commandId - Command ID to execute
   * @param args - Command arguments
   * @returns Command execution result
   */
  async executeCommand(commandId: string, args?: unknown[]): Promise<CommandExecutionResult> {
    const command = this.commands.get(commandId);
    
    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandId}`,
      };
    }

    try {
      // Execute command via Extension Host with timeout
      const result = await Promise.race([
        this.extensionHostManager.sendRequest('command.execute', {
          commandId,
          args: args || [],
        }),
        // Timeout after 5 seconds
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Command execution timeout (${COMMAND_TIMEOUT_MS}ms)`));
          }, COMMAND_TIMEOUT_MS);
        }),
      ]);

      return {
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[ExtensionCommandService] Command execution failed for ${commandId}:`, error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List all registered commands.
   */
  listCommands(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by ID.
   */
  getCommand(commandId: string): RegisteredCommand | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Check if a command is registered.
   */
  hasCommand(commandId: string): boolean {
    return this.commands.has(commandId);
  }
}
