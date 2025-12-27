/**
 * CommandManager - Manages command registration and execution in Extension Host.
 * 
 * P1 (Process Isolation): Runs in Extension Host process only.
 * Commands are registered by extensions and executed when requested by main process.
 */


/**
 * Command handler function type.
 */
export type CommandHandler = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Registered command.
 */
interface RegisteredCommand {
  id: string;
  handler: CommandHandler;
  extensionId: string;
}

/**
 * CommandManager tracks command registrations and handles execution.
 */
export class CommandManager {
  private commands: Map<string, RegisteredCommand>;

  constructor() {
    this.commands = new Map();
  }

  /**
   * Register a command handler from an extension.
   * 
   * @param commandId - Unique command ID
   * @param handler - Function to execute when command is invoked
   * @param extensionId - ID of the extension registering the command
   */
  registerCommand(commandId: string, handler: CommandHandler, extensionId: string): void {
    if (this.commands.has(commandId)) {
      console.warn(`[CommandManager] Command ${commandId} already registered, overwriting`);
    }

    this.commands.set(commandId, {
      id: commandId,
      handler,
      extensionId,
    });

    console.log(`[CommandManager] Registered command ${commandId} from ${extensionId}`);
  }

  /**
   * Unregister commands from an extension.
   * 
   * @param extensionId - Extension ID
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
      console.log(`[CommandManager] Unregistered ${toRemove.length} commands from ${extensionId}`);
    }
  }

  /**
   * Execute a command by ID.
   * 
   * @param commandId - Command ID to execute
   * @param args - Command arguments
   * @returns Command execution result
   */
  async executeCommand(commandId: string, args: unknown[] = []): Promise<unknown> {
    const command = this.commands.get(commandId);

    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    try {
      console.log(`[CommandManager] Executing command ${commandId} from ${command.extensionId}`);
      
      // Call the command handler with args
      const result = await command.handler(...args);
      
      return result;
    } catch (error) {
      console.error(`[CommandManager] Command execution failed for ${commandId}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered command IDs.
   */
  getCommandIds(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Check if a command is registered.
   */
  hasCommand(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  /**
   * Get command metadata for all commands from an extension.
   */
  getExtensionCommands(extensionId: string): Array<{ id: string }> {
    const result: Array<{ id: string }> = [];

    for (const [id, command] of this.commands.entries()) {
      if (command.extensionId === extensionId) {
        result.push({ id });
      }
    }

    return result;
  }
}
