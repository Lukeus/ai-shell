import * as brokerMainModule from 'packages-broker-main';
import type { ExtensionToolService } from '../services/extension-tool-service';
import { AgentHostManager } from '../services/agent-host-manager';
import { auditService } from '../services/AuditService';
import { getMcpServerManager } from '../services/McpServerManager';
import { McpToolBridge } from '../services/McpToolBridge';
import { updateHostContext } from './host-context';

type AgentHostRuntime = {
  agentHostManager: AgentHostManager;
  mcpToolBridge: McpToolBridge;
};

export const initializeAgentHost = (options: {
  agentHostPath: string;
  getExtensionToolService: () => ExtensionToolService | null;
}): AgentHostRuntime => {
  const { agentHostPath, getExtensionToolService } = options;
  const BrokerMain = brokerMainModule.BrokerMain;
  const brokerMain = new BrokerMain({
    auditLogger: {
      logAgentToolAccess: (input) => {
        auditService.logAgentToolAccess(input);
      },
    },
  });

  const mcpToolBridge = new McpToolBridge({
    brokerMain,
    serverManager: getMcpServerManager(),
  });

  const agentHostManager = new AgentHostManager({
    agentHostPath,
    brokerMain,
    getExtensionToolService,
    getMcpToolBridge: () => mcpToolBridge,
  });

  updateHostContext({
    agentHostManager,
    mcpToolBridge,
  });

  agentHostManager.start().catch((error) => {
    console.error('[Main] Failed to start Agent Host:', error);
  });

  return { agentHostManager, mcpToolBridge };
};
