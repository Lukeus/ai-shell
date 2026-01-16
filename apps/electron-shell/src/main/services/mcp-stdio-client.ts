import { JsonValueSchema, McpToolDefinitionSchema, type JsonValue, type McpToolDefinition } from 'packages-api-contracts';
import { z } from 'zod';
import type { Readable, Writable } from 'stream';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const DEFAULT_TIMEOUT_MS = 15000;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
};

const ToolsListResponseSchema = z.object({
  tools: z.array(McpToolDefinitionSchema),
});

class McpJsonRpcClient {
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private closed = false;

  constructor(private readonly input: Readable, private readonly output: Writable) {
    this.input.on('data', (chunk: Buffer) => this.handleChunk(chunk));
    this.input.on('close', () => this.close(new Error('MCP stdio closed')));
    this.input.on('error', (error) => this.close(error));
  }

  public async sendRequest(
    method: string,
    params?: unknown,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<unknown> {
    if (this.closed) {
      throw new Error('MCP client is closed');
    }
    const id = this.nextId++;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.send(request);
    });
  }

  public sendNotification(method: string, params?: unknown): void {
    if (this.closed) {
      return;
    }
    const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    this.send(notification);
  }

  public close(reason?: Error): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const error = reason ?? new Error('MCP client closed');
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private send(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): void {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    this.output.write(header + json);
  }

  private handleChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }
      const headerText = this.buffer.slice(0, headerEnd).toString('ascii');
      const match = /Content-Length:\s*(\d+)/i.exec(headerText);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number.parseInt(match[1], 10);
      const messageStart = headerEnd + 4;
      if (this.buffer.length < messageStart + length) {
        return;
      }
      const body = this.buffer.slice(messageStart, messageStart + length).toString('utf8');
      this.buffer = this.buffer.slice(messageStart + length);
      this.handleMessage(body);
    }
  }

  private handleMessage(body: string): void {
    let message: unknown;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') {
      return;
    }
    const payload = message as Partial<JsonRpcResponse & JsonRpcRequest>;
    if (payload.jsonrpc !== '2.0' || typeof payload.id !== 'number') {
      return;
    }
    if ('result' in payload || 'error' in payload) {
      this.handleResponse(payload as JsonRpcResponse);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);
    clearTimeout(pending.timeout);
    if (response.error) {
      pending.reject(new Error(response.error.message));
      return;
    }
    pending.resolve(response.result);
  }
}

type McpClientInfo = {
  name: string;
  version: string;
};

type McpStdioClientOptions = {
  clientInfo?: McpClientInfo;
  timeoutMs?: number;
};

export class McpStdioClient {
  private readonly rpc: McpJsonRpcClient;
  private readonly timeoutMs: number;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private readonly clientInfo: McpClientInfo;

  constructor(input: Readable, output: Writable, options: McpStdioClientOptions = {}) {
    this.rpc = new McpJsonRpcClient(input, output);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.clientInfo = options.clientInfo ?? { name: 'ai-shell', version: 'dev' };
  }

  public async listTools(): Promise<McpToolDefinition[]> {
    await this.ensureInitialized();
    const response = await this.rpc.sendRequest('tools/list', {}, this.timeoutMs);
    const parsed = ToolsListResponseSchema.parse(response);
    return parsed.tools;
  }

  public async callTool(toolName: string, input?: JsonValue): Promise<JsonValue> {
    await this.ensureInitialized();
    const params: Record<string, unknown> = { name: toolName };
    if (input !== undefined) {
      params.arguments = input;
    }
    const response = await this.rpc.sendRequest('tools/call', params, this.timeoutMs);
    return JsonValueSchema.parse(response);
  }

  public close(): void {
    this.rpc.close();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (!this.initializing) {
      this.initializing = this.rpc
        .sendRequest(
          'initialize',
          {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: this.clientInfo,
          },
          this.timeoutMs
        )
        .then(() => {
          this.rpc.sendNotification('initialized', {});
          this.initialized = true;
        })
        .finally(() => {
          this.initializing = null;
        });
    }
    await this.initializing;
  }
}
