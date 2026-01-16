import { describe, it, expect } from 'vitest';
import {
  McpListServersResponseSchema,
  McpServerContributionSchema,
  McpServerStatusSchema,
  McpToolCallSchema,
  McpToolListResponseSchema,
} from './mcp';

describe('MCP schemas', () => {
  it('validates an MCP server contribution', () => {
    const contribution = {
      id: 'workspace',
      name: 'Workspace MCP',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: {
        API_KEY: { source: 'secret' },
        PROJECT_ID: { source: 'config', key: 'projectId' },
      },
      connectionProviderId: 'openai',
    };

    expect(McpServerContributionSchema.parse(contribution)).toEqual(contribution);
  });

  it('validates MCP server status', () => {
    const status = {
      extensionId: 'acme.mcp-tools',
      serverId: 'workspace',
      state: 'running',
      updatedAt: new Date().toISOString(),
    };

    expect(McpServerStatusSchema.parse(status)).toEqual(status);
  });

  it('validates MCP server list response', () => {
    const now = new Date().toISOString();
    const response = {
      servers: [
        {
          extensionId: 'acme.mcp-tools',
          serverId: 'workspace',
          name: 'Workspace MCP',
          transport: 'stdio',
          enabled: true,
          status: {
            extensionId: 'acme.mcp-tools',
            serverId: 'workspace',
            state: 'running',
            updatedAt: now,
          },
        },
      ],
    };

    expect(McpListServersResponseSchema.parse(response)).toEqual(response);
  });

  it('validates MCP tool list and call schemas', () => {
    const list = {
      server: {
        extensionId: 'acme.mcp-tools',
        serverId: 'workspace',
      },
      tools: [
        {
          name: 'readFile',
          description: 'Read a file from the workspace.',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        },
      ],
    };

    const call = {
      extensionId: 'acme.mcp-tools',
      serverId: 'workspace',
      toolName: 'readFile',
      input: { path: '/workspace/README.md' },
    };

    expect(McpToolListResponseSchema.parse(list)).toEqual(list);
    expect(McpToolCallSchema.parse(call)).toEqual(call);
  });
});
