/**
 * ToolManager - Manages tool registration in Extension Host.
 * 
 * P1 (Process Isolation): Runs in Extension Host process only.
 * Tools are registered by extensions and callable by Agent Host.
 */

/**
 * Tool handler function type.
 * Extensions provide tool implementations through this function.
 */
export type ToolHandler = (input: unknown) => unknown | Promise<unknown>;

/**
 * Registered tool.
 */
interface RegisteredTool {
  name: string;
  handler: ToolHandler;
  extensionId: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * ToolManager tracks tool registrations and handles execution.
 */
export class ToolManager {
  private tools: Map<string, RegisteredTool>;

  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a tool handler from an extension.
   * 
   * @param name - Tool name (unique within extension)
   * @param description - Tool description for agent context
   * @param inputSchema - JSON Schema for tool input parameters
   * @param handler - Function to execute when tool is invoked
   * @param extensionId - ID of the extension registering the tool
   */
  registerTool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler,
    extensionId: string
  ): void {
    const fullToolName = `${extensionId}.${name}`;

    if (this.tools.has(fullToolName)) {
      console.warn(`[ToolManager] Tool ${fullToolName} already registered, overwriting`);
    }

    this.tools.set(fullToolName, {
      name: fullToolName,
      handler,
      extensionId,
      description,
      inputSchema,
    });

    console.log(`[ToolManager] Registered tool ${fullToolName} from ${extensionId}`);
  }

  /**
   * Unregister tools from an extension.
   * 
   * @param extensionId - Extension ID
   */
  unregisterExtensionTools(extensionId: string): void {
    const toRemove: string[] = [];

    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.extensionId === extensionId) {
        toRemove.push(toolName);
      }
    }

    for (const toolName of toRemove) {
      this.tools.delete(toolName);
    }

    if (toRemove.length > 0) {
      console.log(`[ToolManager] Unregistered ${toRemove.length} tools from ${extensionId}`);
    }
  }

  /**
   * Execute a tool by name.
   * 
   * @param toolName - Tool name to execute (extensionId.toolName)
   * @param input - Tool input parameters
   * @returns Tool execution result
   */
  async executeTool(toolName: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      console.log(`[ToolManager] Executing tool ${toolName} from ${tool.extensionId}`);
      
      // Task 8 invariant: Tool schemas validated against ToolContributionSchema
      // Validation happens during registration via ContributionRegistry
      const result = await tool.handler(input);
      
      return result;
    } catch (error) {
      console.error(`[ToolManager] Tool execution failed for ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered tool names.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered.
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool metadata for all tools from an extension.
   */
  getExtensionTools(extensionId: string): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    const result: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }> = [];

    for (const [name, tool] of this.tools.entries()) {
      if (tool.extensionId === extensionId) {
        result.push({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }

    return result;
  }
}
