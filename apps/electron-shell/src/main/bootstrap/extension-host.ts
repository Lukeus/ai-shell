import fs from 'fs';
import path from 'path';
import { ExtensionActivationService } from '../services/ExtensionActivationService';
import { ExtensionCommandService } from '../services/extension-command-service';
import { ExtensionHostManager } from '../services/extension-host-manager';
import { ExtensionRegistry } from '../services/extension-registry';
import { ExtensionStateManager } from '../services/extension-state-manager';
import { ExtensionToolService } from '../services/extension-tool-service';
import { ExtensionViewService } from '../services/extension-view-service';
import { PermissionService } from '../services/permission-service';
import type { WorkspaceService } from '../services/WorkspaceService';
import { updateHostContext } from './host-context';

type ExtensionInfrastructure = {
  extensionsDir: string;
  extensionRegistry: ExtensionRegistry;
  extensionRegistryReady: Promise<void>;
  extensionStateManager: ExtensionStateManager;
};

type ExtensionHostRuntime = {
  extensionCommandService: ExtensionCommandService;
  extensionViewService: ExtensionViewService;
  extensionToolService: ExtensionToolService;
  extensionHostManager: ExtensionHostManager;
  extensionActivationService: ExtensionActivationService;
  start: () => Promise<void>;
};

export const initializeExtensionInfrastructure = (userDataPath: string): ExtensionInfrastructure => {
  const extensionsDir = path.join(userDataPath, 'extensions');

  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }

  const extensionRegistry = new ExtensionRegistry(extensionsDir);
  const extensionRegistryReady = extensionRegistry.initialize().catch((error) => {
    console.error('[Main] Failed to initialize Extension Registry:', error);
  });

  const permissionService = new PermissionService(extensionsDir);
  permissionService.initialize().catch((error) => {
    console.error('[Main] Failed to initialize Permission Service:', error);
  });

  const extensionStateManager = new ExtensionStateManager();

  updateHostContext({
    extensionRegistry,
    permissionService,
    extensionStateManager,
  });

  return {
    extensionsDir,
    extensionRegistry,
    extensionRegistryReady,
    extensionStateManager,
  };
};

export const initializeExtensionHost = (options: {
  extensionHostPath: string;
  infrastructure: ExtensionInfrastructure;
  workspaceService: WorkspaceService;
}): ExtensionHostRuntime => {
  const { extensionHostPath, infrastructure, workspaceService } = options;
  const {
    extensionsDir,
    extensionRegistry,
    extensionRegistryReady,
    extensionStateManager,
  } = infrastructure;

  const extensionHostManager = new ExtensionHostManager({
    extensionHostPath,
    extensionsDir,
    stateManager: extensionStateManager,
  });

  const extensionActivationService = new ExtensionActivationService({
    extensionRegistry,
    extensionHostManager,
    workspaceService,
    extensionsDir,
  });

  const ensureActivated = (extensionId: string, event: string) =>
    extensionActivationService.ensureActivated(extensionId, event);

  const extensionCommandService = new ExtensionCommandService(
    extensionHostManager,
    ensureActivated
  );

  const extensionViewService = new ExtensionViewService(
    extensionHostManager,
    ensureActivated
  );

  const extensionToolService = new ExtensionToolService(
    extensionHostManager,
    ensureActivated
  );

  updateHostContext({
    extensionHostManager,
    extensionActivationService,
    extensionCommandService,
    extensionViewService,
    extensionToolService,
  });

  const start = (): Promise<void> =>
    extensionHostManager
      .start()
      .then(async () => {
        await extensionRegistryReady;
        await extensionActivationService.registerEnabledExtensions();
        await extensionActivationService.syncContributions({
          commands: extensionCommandService,
          views: extensionViewService,
          tools: extensionToolService,
        });
        await extensionActivationService.activateStartupExtensions();
      })
      .catch((error) => {
        console.error('[Main] Failed to start Extension Host:', error);
      });

  return {
    extensionCommandService,
    extensionViewService,
    extensionToolService,
    extensionHostManager,
    extensionActivationService,
    start,
  };
};
