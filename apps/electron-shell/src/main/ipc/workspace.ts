import { ipcMain } from 'electron';
import { IPC_CHANNELS, type Workspace } from 'packages-api-contracts';
import { workspaceService } from '../services/WorkspaceService';

export const registerWorkspaceHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN, async (): Promise<Workspace | null> => {
    return workspaceService.openWorkspace();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_CURRENT, async (): Promise<Workspace | null> => {
    return workspaceService.getWorkspace();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CLOSE, async (): Promise<void> => {
    workspaceService.clearWorkspace();
  });
};
