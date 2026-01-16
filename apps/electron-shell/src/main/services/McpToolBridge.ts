import Ajv, { type ValidateFunction } from 'ajv';
import { JsonValueSchema, McpToolDefinitionSchema, type JsonValue, type McpServerRef, type McpToolDefinition, type McpToolListResponse } from 'packages-api-contracts';
import { z } from 'zod';
import type { ToolDefinition } from 'packages-agent-tools';
import type { ChildProcess } from 'child_process';
import { buildMcpServerKey } from './mcp-server-definitions';
import { McpStdioClient } from './mcp-stdio-client';

type BrokerMainLike = {
  registerToolDefinition: (tool: ToolDefinition) => void;
  unregisterTool: (toolId: string) => void;
  listTools: () => string[];
};

type McpServerManagerLike = {
  getServerProcess: (ref: McpServerRef) => ChildProcess | null;
  setTools?: (ref: McpServerRef, tools: McpToolDefinition[]) => void;
};

type McpClient = {
  listTools: () => Promise<McpToolDefinition[]>;
  callTool: (toolName: string, input?: JsonValue) => Promise<JsonValue>;
  close: () => void;
};

type McpToolBridgeDeps = {
  brokerMain: BrokerMainLike;
  serverManager: McpServerManagerLike;
  clientFactory?: (child: ChildProcess) => McpClient;
};

type ServerToolCache = {
  toolIds: string[];
  tools: McpToolDefinition[];
};

const TOOL_PREFIX = 'mcp:';

export const buildMcpToolId = (ref: McpServerRef, toolName: string): string => {
  return `${TOOL_PREFIX}${encodeURIComponent(ref.extensionId)}:${encodeURIComponent(ref.serverId)}:${encodeURIComponent(toolName)}`;
};

const parseMcpToolId = (toolId: string): { ref: McpServerRef; toolName: string } | null => {
  if (!toolId.startsWith(TOOL_PREFIX)) {
    return null;
  }
  const parts = toolId.slice(TOOL_PREFIX.length).split(':');
  if (parts.length !== 3) {
    return null;
  }
  const [extensionId, serverId, toolName] = parts.map((part) => decodeURIComponent(part));
  if (!extensionId || !serverId || !toolName) {
    return null;
  }
  return { ref: { extensionId, serverId }, toolName };
};

export class McpToolBridge {
  private readonly brokerMain: BrokerMainLike;
  private readonly serverManager: McpServerManagerLike;
  private readonly clientFactory: (child: ChildProcess) => McpClient;
  private readonly ajv: Ajv;
  private readonly clients = new Map<string, { child: ChildProcess; client: McpClient }>();
  private readonly toolsByServer = new Map<string, ServerToolCache>();

  constructor(deps: McpToolBridgeDeps) {
    this.brokerMain = deps.brokerMain;
    this.serverManager = deps.serverManager;
    this.clientFactory = deps.clientFactory ?? ((child) => {
      if (!child.stdout || !child.stdin) {
        throw new Error('MCP server stdio not available');
      }
      return new McpStdioClient(child.stdout, child.stdin);
    });
    this.ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  }

  public isMcpTool(toolId: string): boolean {
    return toolId.startsWith(TOOL_PREFIX);
  }

  public async ensureToolRegistered(toolId: string): Promise<boolean> {
    const parsed = parseMcpToolId(toolId);
    if (!parsed) {
      return false;
    }
    if (this.brokerMain.listTools().includes(toolId)) {
      return true;
    }
    const response = await this.refreshServerTools(parsed.ref);
    return response.tools.some((tool) => buildMcpToolId(parsed.ref, tool.name) === toolId);
  }

  public async refreshServerTools(ref: McpServerRef): Promise<McpToolListResponse> {
    try {
      const tools = await this.listToolsFromServer(ref);
      this.registerServerTools(ref, tools);
      this.setServerTools(ref, tools);
      return { server: ref, tools };
    } catch {
      this.clearServerTools(ref);
      return { server: ref, tools: [] };
    }
  }

  public clearServerTools(ref: McpServerRef): void {
    const key = buildMcpServerKey(ref.extensionId, ref.serverId);
    const cache = this.toolsByServer.get(key);
    if (cache) {
      cache.toolIds.forEach((toolId) => this.brokerMain.unregisterTool(toolId));
      this.toolsByServer.delete(key);
    }
    this.setServerTools(ref, []);
  }

  private setServerTools(ref: McpServerRef, tools: McpToolDefinition[]): void {
    if (!this.serverManager.setTools) {
      return;
    }
    try {
      this.serverManager.setTools(ref, tools);
    } catch {
      // Ignore tool cache updates if definitions are unavailable.
    }
  }

  private async listToolsFromServer(ref: McpServerRef): Promise<McpToolDefinition[]> {
    const client = this.getClient(ref);
    const tools = await client.listTools();
    return McpToolDefinitionSchema.array().parse(tools);
  }

  private registerServerTools(ref: McpServerRef, tools: McpToolDefinition[]): void {
    this.clearServerTools(ref);
    const toolIds: string[] = [];
    tools.forEach((tool) => {
      const toolId = buildMcpToolId(ref, tool.name);
      const inputSchema = this.buildValidator(tool.inputSchema, 'input');
      const outputSchema = tool.outputSchema
        ? this.buildValidator(tool.outputSchema, 'output')
        : JsonValueSchema;
      const definition: ToolDefinition = {
        id: toolId,
        description: tool.description ?? toolId,
        inputSchema,
        outputSchema,
        category: 'other',
        execute: async (input) => {
          return this.callTool(ref, tool.name, input as JsonValue);
        },
      };
      this.brokerMain.registerToolDefinition(definition);
      toolIds.push(toolId);
    });
    this.toolsByServer.set(buildMcpServerKey(ref.extensionId, ref.serverId), {
      toolIds,
      tools,
    });
  }

  private async callTool(ref: McpServerRef, toolName: string, input?: JsonValue): Promise<JsonValue> {
    const client = this.getClient(ref);
    return client.callTool(toolName, input);
  }

  private getClient(ref: McpServerRef): McpClient {
    const key = buildMcpServerKey(ref.extensionId, ref.serverId);
    const child = this.serverManager.getServerProcess(ref);
    if (!child) {
      throw new Error('MCP server process not running');
    }
    const existing = this.clients.get(key);
    if (existing && existing.child === child) {
      return existing.client;
    }
    if (existing) {
      existing.client.close();
      this.clients.delete(key);
    }
    const client = this.clientFactory(child);
    this.clients.set(key, { child, client });
    child.once('exit', () => {
      this.handleServerExit(ref, child);
    });
    return client;
  }

  private handleServerExit(ref: McpServerRef, child: ChildProcess): void {
    const key = buildMcpServerKey(ref.extensionId, ref.serverId);
    const entry = this.clients.get(key);
    if (!entry || entry.child !== child) {
      return;
    }
    entry.client.close();
    this.clients.delete(key);
    this.clearServerTools(ref);
  }

  private buildValidator(schema: Record<string, unknown> | undefined, label: string): z.ZodTypeAny {
    if (!schema) {
      return JsonValueSchema;
    }
    let validate: ValidateFunction;
    try {
      validate = this.ajv.compile(schema);
    } catch {
      return z.any().superRefine((_value, ctx) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid ${label} schema.`,
        });
      });
    }
    return JsonValueSchema.superRefine((value, ctx) => {
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
