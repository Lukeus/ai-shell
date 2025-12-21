import { z } from 'zod';

export const ToolCategorySchema = z.enum(['fs', 'repo', 'net', 'system', 'other']);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export type ToolExecutionContext = {
  envelope?: unknown;
};

export type ToolDefinition = {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  category?: ToolCategory;
  execute: (input: unknown, context?: ToolExecutionContext) => Promise<unknown> | unknown;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  public unregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  public get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  public list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}
