/**
 * ExtensionToolService - Aggregates and manages extension-contributed tools.
 * 
 * P1 (Process isolation): Tool execution happens in Extension Host, not main process.
 * P2 (Security): Agent Host communicates via main process, never directly to Extension Host.
 */

import { z } from 'zod';
import Ajv, { type ValidateFunction } from 'ajv';
import { ExtensionHostManager } from './extension-host-manager';

/**
 * Registered tool metadata.
 */
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  extensionId: string;
  inputValidator?: z.ZodTypeAny;
  outputValidator?: z.ZodTypeAny;
}

/**
 * Tool execution result.
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

type ExtensionActivationHandler = (extensionId: string, event?: string) => Promise<void>;

/**
 * ExtensionToolService manages tool registration and execution.
 * Tools are callable by Agent Host for extension functionality.
 */
export class ExtensionToolService {
  private extensionHostManager: ExtensionHostManager;
  private tools: Map<string, RegisteredTool>;
  private activateExtension?: ExtensionActivationHandler;
  private ajv: Ajv;

  constructor(
    extensionHostManager: ExtensionHostManager,
    activateExtension?: ExtensionActivationHandler
  ) {
    this.extensionHostManager = extensionHostManager;
    this.tools = new Map();
    this.activateExtension = activateExtension;
    this.ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
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
    const inputValidator = this.buildValidator(tool.inputSchema, 'input');
    const outputValidator = tool.outputSchema
      ? this.buildValidator(tool.outputSchema, 'output')
      : undefined;

    this.tools.set(tool.name, {
      ...tool,
      inputValidator,
      outputValidator,
    });
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
      if (tool.inputValidator) {
        const parsed = tool.inputValidator.safeParse(input);
        if (!parsed.success) {
          return {
            success: false,
            error: 'Tool input failed schema validation.',
          };
        }
        input = parsed.data;
      }

      if (this.activateExtension) {
        await this.activateExtension(tool.extensionId, `onTool:${toolName}`);
      }

      // Execute tool via Extension Host
      const result = await this.extensionHostManager.sendRequest('tool.execute', {
        toolName,
        input,
      });

      if (tool.outputValidator) {
        const parsed = tool.outputValidator.safeParse(result);
        if (!parsed.success) {
          return {
            success: false,
            error: 'Tool output failed schema validation.',
          };
        }
        return {
          success: true,
          result: parsed.data,
        };
      }

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
   * Reset all registered tools (used during contribution sync).
   */
  reset(): void {
    this.tools.clear();
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

  private buildValidator(schema: Record<string, unknown>, label: string): z.ZodTypeAny {
    let validate: ValidateFunction;
    try {
      validate = this.ajv.compile(schema);
    } catch (error) {
      console.warn(`[ExtensionToolService] Invalid ${label} schema`, error);
      return z.any().superRefine((_value, ctx) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid ${label} schema.`,
        });
      });
    }
    return z.any().superRefine((value, ctx) => {
      const ok = validate(value);
      if (ok) {
        return;
      }
      const error = validate.errors?.[0];
      const message = error?.message ? `${label} ${error.message}` : `${label} schema invalid`;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
    });
  }
}
