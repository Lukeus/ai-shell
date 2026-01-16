import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { McpToolBridge, buildMcpToolId } from './McpToolBridge';
import type { McpServerRef } from 'packages-api-contracts';

class FakeChildProcess extends EventEmitter {
  public stdin = new PassThrough();
  public stdout = new PassThrough();
  public stderr = new PassThrough();
}

class FakeBrokerMain {
  public tools = new Map<string, { id: string; execute: (input: unknown) => Promise<unknown> | unknown }>();
  public registerToolDefinition = vi.fn((tool) => {
    this.tools.set(tool.id, tool);
  });
  public unregisterTool = vi.fn((toolId: string) => {
    this.tools.delete(toolId);
  });
  public listTools = vi.fn(() => Array.from(this.tools.keys()));
}

const serverRef: McpServerRef = {
  extensionId: 'acme.sample-extension',
  serverId: 'sample.mcp',
};

describe('McpToolBridge', () => {
  let child: FakeChildProcess;
  let broker: FakeBrokerMain;
  let serverManager: { getServerProcess: ReturnType<typeof vi.fn>; setTools: ReturnType<typeof vi.fn> };
  let client: {
    listTools: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  const createBridge = () => new McpToolBridge({
    brokerMain: broker,
    serverManager,
    clientFactory: () => client,
  });

  beforeEach(() => {
    child = new FakeChildProcess();
    broker = new FakeBrokerMain();
    serverManager = {
      getServerProcess: vi.fn(() => child),
      setTools: vi.fn(),
    };
    client = {
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };
  });

  it('registers MCP tools on refresh', async () => {
    client.listTools.mockResolvedValue([
      {
        name: 'echo',
        description: 'Echo tool',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
      },
    ]);

    const bridge = createBridge();
    const response = await bridge.refreshServerTools(serverRef);

    const toolId = buildMcpToolId(serverRef, 'echo');
    expect(response.tools).toHaveLength(1);
    expect(broker.listTools()).toContain(toolId);
    expect(serverManager.setTools).toHaveBeenCalledWith(serverRef, response.tools);
  });

  it('routes tool execution to the MCP client', async () => {
    client.listTools.mockResolvedValue([
      {
        name: 'echo',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    ]);
    client.callTool.mockResolvedValue({ ok: true });

    const bridge = createBridge();
    await bridge.refreshServerTools(serverRef);

    const toolId = buildMcpToolId(serverRef, 'echo');
    const tool = broker.tools.get(toolId);
    expect(tool).toBeDefined();

    const output = await tool?.execute({ message: 'hi' });

    expect(client.callTool).toHaveBeenCalledWith('echo', { message: 'hi' });
    expect(output).toEqual({ ok: true });
  });

  it('clears tools when the server exits', async () => {
    client.listTools.mockResolvedValue([
      {
        name: 'echo',
        inputSchema: { type: 'object' },
      },
    ]);

    const bridge = createBridge();
    await bridge.refreshServerTools(serverRef);

    child.emit('exit', 0, null);

    expect(broker.listTools()).toHaveLength(0);
    expect(client.close).toHaveBeenCalled();
  });
});
