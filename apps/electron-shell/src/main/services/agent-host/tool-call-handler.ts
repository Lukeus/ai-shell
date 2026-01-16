import { JsonValueSchema, type ToolCallEnvelope, type ToolCallResult } from 'packages-api-contracts';
import type { ExtensionToolService } from '../extension-tool-service';
import type { McpToolBridge } from '../McpToolBridge';
import type { AgentHostToolResultMessage } from './agent-host-messages';
import type { BuiltInToolsRegistrar } from './built-in-tools';
import type { BrokerMainInstance } from './types';

type ToolCallHandlerDeps = {
  brokerMain: BrokerMainInstance;
  builtInTools: BuiltInToolsRegistrar;
  getExtensionToolService?: () => ExtensionToolService | null;
  getMcpToolBridge?: () => McpToolBridge | null;
  sendMessage: (message: AgentHostToolResultMessage) => void;
};

export type ToolCallHandler = (envelope: ToolCallEnvelope) => Promise<void>;

export const createToolCallHandler = (deps: ToolCallHandlerDeps): ToolCallHandler => {
  const { brokerMain, builtInTools, getExtensionToolService, getMcpToolBridge, sendMessage } = deps;

  return async (envelope: ToolCallEnvelope): Promise<void> => {
    builtInTools.registerOnce();

    const mcpToolBridge = getMcpToolBridge?.();
    if (mcpToolBridge?.isMcpTool(envelope.toolId)) {
      try {
        await mcpToolBridge.ensureToolRegistered(envelope.toolId);
      } catch {
        // Ignore MCP tool registration failures; broker handles missing tools.
      }
    }

    const extensionToolService = getExtensionToolService?.();
    if (extensionToolService?.hasTool(envelope.toolId)) {
      const registered = brokerMain.listTools().includes(envelope.toolId);
      if (!registered) {
        const tool = extensionToolService.getTool(envelope.toolId);
        brokerMain.registerToolDefinition({
          id: envelope.toolId,
          description: tool?.description ?? envelope.toolId,
          inputSchema: tool?.inputValidator ?? JsonValueSchema,
          outputSchema: tool?.outputValidator ?? JsonValueSchema,
          category: 'other',
          execute: async (input) => {
            const result = await extensionToolService.executeTool(envelope.toolId, input);
            if (!result.success) {
              throw new Error(result.error ?? 'Tool execution failed');
            }
            return result.result;
          },
        });
      }
    }

    const result = await brokerMain.handleAgentToolCall(envelope);

    const validatedResult: ToolCallResult = {
      ...result,
      output: result.output !== undefined ? JsonValueSchema.parse(result.output) : undefined,
    };

    const response: AgentHostToolResultMessage = {
      type: 'agent-host:tool-result',
      payload: validatedResult,
    };

    sendMessage(response);
  };
};
