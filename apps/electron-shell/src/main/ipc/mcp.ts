import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  McpServerControlRequestSchema,
  McpServerStatusRequestSchema,
  type McpListServersResponse,
  type McpServerStatus,
  type McpToolListResponse,
} from 'packages-api-contracts';
import { getMcpToolBridge } from '../index';
import { getMcpServerManager } from '../services/McpServerManager';

export const registerMcpHandlers = (): void => {
  const manager = getMcpServerManager();

  ipcMain.handle(IPC_CHANNELS.MCP_SERVERS_LIST, async (): Promise<McpListServersResponse> => {
    return manager.listServers();
  });

  ipcMain.handle(
    IPC_CHANNELS.MCP_SERVER_STATUS,
    async (_event, request: unknown): Promise<McpServerStatus> => {
      const validated = McpServerStatusRequestSchema.parse(request);
      return manager.getStatus(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_SERVER_START,
    async (_event, request: unknown): Promise<McpServerStatus> => {
      const validated = McpServerControlRequestSchema.parse(request);
      return await manager.startServer(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_SERVER_STOP,
    async (_event, request: unknown): Promise<McpServerStatus> => {
      const validated = McpServerControlRequestSchema.parse(request);
      return await manager.stopServer(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_TOOLS_REFRESH,
    async (_event, request: unknown): Promise<McpToolListResponse> => {
      const validated = McpServerControlRequestSchema.parse(request);
      const toolBridge = getMcpToolBridge();
      if (toolBridge) {
        return await toolBridge.refreshServerTools(validated);
      }
      return await manager.refreshTools(validated);
    }
  );
};
