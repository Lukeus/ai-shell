import { ipcMain } from 'electron';
import { z } from 'zod';
import {
  ExtensionExecuteCommandRequestSchema,
  ExtensionIdRequestSchema,
  IPC_CHANNELS,
  JsonValueSchema,
  ListExtensionsResponse,
  PermissionCheckResultSchema,
  PermissionRequestSchema,
} from 'packages-api-contracts';
import { handleSafe } from './safeIpc';
import {
  getExtensionCommandService,
  getExtensionRegistry,
  getExtensionViewService,
  getPermissionService,
} from '../index';

export const registerExtensionHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_LIST,
    async (): Promise<ListExtensionsResponse> => {
      const registry = getExtensionRegistry();
      if (!registry) {
        return { extensions: [] };
      }

      const extensions = registry.getAllExtensions().map((item) => ({
        manifest: item.manifest,
        enabled: item.enabled,
        installedAt: item.installedAt,
        updatedAt: item.updatedAt,
      }));

      return { extensions };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_GET,
    async (_event, request: unknown) => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        return null;
      }

      const extension = registry.getExtension(validated.extensionId);
      if (!extension) {
        return null;
      }

      return {
        manifest: extension.manifest,
        enabled: extension.enabled,
        installedAt: extension.installedAt,
        updatedAt: extension.updatedAt,
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_ENABLE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        throw new Error('Extension registry not initialized');
      }

      const ok = await registry.enableExtension(validated.extensionId);
      if (!ok) {
        throw new Error(`Extension not found: ${validated.extensionId}`);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_DISABLE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        throw new Error('Extension registry not initialized');
      }

      const ok = await registry.disableExtension(validated.extensionId);
      if (!ok) {
        throw new Error(`Extension not found: ${validated.extensionId}`);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_UNINSTALL,
    async (_event, request: unknown): Promise<void> => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const registry = getExtensionRegistry();
      if (!registry) {
        throw new Error('Extension registry not initialized');
      }

      const ok = await registry.uninstallExtension(validated.extensionId);
      if (!ok) {
        throw new Error(`Extension not found: ${validated.extensionId}`);
      }
    }
  );

  handleSafe(
    IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND,
    {
      inputSchema: ExtensionExecuteCommandRequestSchema,
      outputSchema: JsonValueSchema,
    },
    async (_event, request) => {
      const commandService = getExtensionCommandService();
      if (!commandService) {
        throw new Error('Extension command service not initialized');
      }

      const execution = await commandService.executeCommand(
        request.commandId,
        request.args
      );
      if (!execution.success) {
        throw new Error(execution.error ?? 'Command execution failed');
      }

      return execution.result ?? null;
    }
  );

  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_LIST_COMMANDS, async () => {
    const commandService = getExtensionCommandService();
    if (!commandService) {
      return [];
    }

    return commandService.listCommands();
  });

  handleSafe(
    IPC_CHANNELS.EXTENSIONS_REQUEST_PERMISSION,
    {
      inputSchema: PermissionRequestSchema,
      outputSchema: z.union([PermissionCheckResultSchema, z.null()]),
    },
    async (_event, request) => {
      const permService = getPermissionService();
      if (!permService) {
        throw new Error('Permission service not initialized');
      }

      return await permService.requestPermission(
        request.extensionId,
        request.scope,
        request.reason
      );
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_LIST_PERMISSIONS,
    async (_event, request: unknown) => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const permService = getPermissionService();
      if (!permService) {
        return [];
      }

      return permService.getAllPermissions(validated.extensionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_REVOKE_PERMISSION,
    async (_event, request: unknown) => {
      const validated = ExtensionIdRequestSchema.parse(request);
      const permService = getPermissionService();
      if (!permService) {
        throw new Error('Permission service not initialized');
      }

      await permService.revokeAllPermissions(validated.extensionId);
    }
  );

  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_LIST_VIEWS, async () => {
    const viewService = getExtensionViewService();
    if (!viewService) {
      return [];
    }

    return viewService.listViews();
  });

  ipcMain.handle(
    IPC_CHANNELS.EXTENSIONS_RENDER_VIEW,
    async (_event, viewId: string) => {
      const viewService = getExtensionViewService();
      if (!viewService) {
        throw new Error('Extension view service not initialized');
      }

      return await viewService.renderView(viewId);
    }
  );
};
