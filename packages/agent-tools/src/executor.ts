import { z } from 'zod';
import type { ToolExecutionContext, ToolRegistry } from './registry';

export type ToolExecutionResult = {
  ok: boolean;
  output?: unknown;
  error?: string;
};

export class ToolExecutor {
  private readonly registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  public async execute(
    toolId: string,
    input: unknown,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.registry.get(toolId);
    if (!tool) {
      return { ok: false, error: `Tool not found: ${toolId}` };
    }

    const inputResult = tool.inputSchema.safeParse(input);
    if (!inputResult.success) {
      return { ok: false, error: this.formatZodError('Invalid tool input', inputResult.error) };
    }

    try {
      const output = await tool.execute(inputResult.data, context);
      if (tool.outputSchema) {
        const outputResult = tool.outputSchema.safeParse(output);
        if (!outputResult.success) {
          return {
            ok: false,
            error: this.formatZodError('Invalid tool output', outputResult.error),
          };
        }
        return { ok: true, output: outputResult.data };
      }

      return { ok: true, output };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      return { ok: false, error: message };
    }
  }

  private formatZodError(prefix: string, error: z.ZodError): string {
    const first = error.errors[0];
    if (!first) {
      return prefix;
    }
    const path = first.path.length > 0 ? ` (${first.path.join('.')})` : '';
    return `${prefix}${path}: ${first.message}`;
  }
}
