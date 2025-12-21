/**
 * ExtensionToolService - Aggregates and manages extension-contributed tools.
 * 
 * P1 (Process isolation): Tool execution happens in Extension Host, not main process.
 * P2 (Security): Agent Host communicates via main process, never directly to Extension Host.
 */

import { ExtensionHostManager } from './extension-host-manager';

/**
 * Registered tool metadata.
 */
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  extensionId: string;
}

/**
 * Tool execution result.
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * ExtensionToolService manages tool registration and execution.
 * Tools are callable by Agent Host for extension functionality.
 */
export class ExtensionToolService {
  private extensionHostManager: ExtensionHostManager;
  private tools: Map<string, RegisteredTool>;

  constructor(extensionHostManager: ExtensionHostManager) {
    this.extensionHostManager = extensionHostManager;
    this.tools = new Map();
  }

  /**
   * Register a tool from an extension.
   * Called by ExtensionHostManager when extensions register tools.
   */
  registerTool(tool: RegisteredTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ExtensionToolService] Tool ${tool.name} already registered, overwriting`);
    }

    // Task 8 invariant: Tool schemas validated against ToolContributionSchema
    // Validation happens during extension manifest loading in ExtensionRegistry
    this.tools.set(tool.name, tool);
    console.log(`[ExtensionToolService] Registered tool ${tool.name} from ${tool.extensionId}`);
  }

  /**
   * Unregister tools from an extension.
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
      console.log(`[ExtensionToolService] Unregistered ${toRemove.length} tools from ${extensionId}`);
    }
  }

  /**
   * Execute a tool by name.
   * Routes execution to Extension Host via JSON-RPC.
   * 
   * @param toolName - Tool name to execute (extensionId.toolName)
   * @param input - Tool input parameters
   * @returns Tool execution result
   */
  async executeTool(toolName: string, input: unknown): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    try {
      // Execute tool via Extension Host
      const result = await this.extensionHostManager.sendRequest('tool.execute', {
        toolName,
        input,
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[ExtensionToolService] Tool execution failed for ${toolName}:`, error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List all registered tools.
   * Task 8 invariant: Extension-contributed tools callable by Agent Host.
   */
  listTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools from a specific extension.
   */
  getExtensionTools(extensionId: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.extensionId === extensionId);
  }

  /**
   * Get tool by name.
   */
  getTool(toolName: string): RegisteredTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Check if a tool is registered.
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}
