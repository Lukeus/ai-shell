import type { AgentHostManager } from '../services/agent-host-manager';
import type { ExtensionActivationService } from '../services/ExtensionActivationService';
import type { ExtensionCommandService } from '../services/extension-command-service';
import type { ExtensionHostManager } from '../services/extension-host-manager';
import type { ExtensionRegistry } from '../services/extension-registry';
import type { ExtensionStateManager } from '../services/extension-state-manager';
import type { ExtensionToolService } from '../services/extension-tool-service';
import type { ExtensionViewService } from '../services/extension-view-service';
import type { McpToolBridge } from '../services/McpToolBridge';
import type { PermissionService } from '../services/permission-service';

type HostContext = {
  extensionHostManager: ExtensionHostManager | null;
  extensionRegistry: ExtensionRegistry | null;
  extensionCommandService: ExtensionCommandService | null;
  extensionViewService: ExtensionViewService | null;
  extensionToolService: ExtensionToolService | null;
  permissionService: PermissionService | null;
  extensionStateManager: ExtensionStateManager | null;
  extensionActivationService: ExtensionActivationService | null;
  agentHostManager: AgentHostManager | null;
  mcpToolBridge: McpToolBridge | null;
};

const hostContext: HostContext = {
  extensionHostManager: null,
  extensionRegistry: null,
  extensionCommandService: null,
  extensionViewService: null,
  extensionToolService: null,
  permissionService: null,
  extensionStateManager: null,
  extensionActivationService: null,
  agentHostManager: null,
  mcpToolBridge: null,
};

export const updateHostContext = (updates: Partial<HostContext>): void => {
  Object.assign(hostContext, updates);
};

export const getExtensionCommandService = (): ExtensionCommandService | null => {
  return hostContext.extensionCommandService;
};

export const getExtensionRegistry = (): ExtensionRegistry | null => {
  return hostContext.extensionRegistry;
};

export const getPermissionService = (): PermissionService | null => {
  return hostContext.permissionService;
};

export const getExtensionViewService = (): ExtensionViewService | null => {
  return hostContext.extensionViewService;
};

export const getExtensionToolService = (): ExtensionToolService | null => {
  return hostContext.extensionToolService;
};

export const getAgentHostManager = (): AgentHostManager | null => {
  return hostContext.agentHostManager;
};

export const getMcpToolBridge = (): McpToolBridge | null => {
  return hostContext.mcpToolBridge;
};

export const getExtensionHostManager = (): ExtensionHostManager | null => {
  return hostContext.extensionHostManager;
};

export const getExtensionActivationService = (): ExtensionActivationService | null => {
  return hostContext.extensionActivationService;
};

export const getExtensionStateManager = (): ExtensionStateManager | null => {
  return hostContext.extensionStateManager;
};
