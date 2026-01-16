import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  ScmStatusRequestSchema,
  ScmStatusResponse,
  ScmStageRequestSchema,
  ScmUnstageRequestSchema,
  ScmCommitRequestSchema,
  ScmCommitResponse,
} from 'packages-api-contracts';
import { gitService } from '../services/GitService';

export const registerScmHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.SCM_STATUS,
    async (_event, request: unknown): Promise<ScmStatusResponse> => {
      ScmStatusRequestSchema.parse(request ?? {});
      return await gitService.getStatus();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SCM_STAGE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ScmStageRequestSchema.parse(request);
      await gitService.stage(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SCM_UNSTAGE,
    async (_event, request: unknown): Promise<void> => {
      const validated = ScmUnstageRequestSchema.parse(request);
      await gitService.unstage(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SCM_COMMIT,
    async (_event, request: unknown): Promise<ScmCommitResponse> => {
      const validated = ScmCommitRequestSchema.parse(request);
      return await gitService.commit(validated);
    }
  );
};
