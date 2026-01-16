import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  ReadDirectoryRequestSchema,
  ReadDirectoryResponse,
  ReadFileRequestSchema,
  ReadFileResponse,
  WriteFileRequestSchema,
  CreateFileRequestSchema,
  CreateDirectoryRequestSchema,
  RenameRequestSchema,
  DeleteRequestSchema,
} from 'packages-api-contracts';
import { fsBrokerService } from '../services/FsBrokerService';

export const registerFsHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.FS_READ_DIRECTORY,
    async (_event, request: unknown): Promise<ReadDirectoryResponse> => {
      const validated = ReadDirectoryRequestSchema.parse(request);
      return await fsBrokerService.readDirectory(validated.path);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FS_READ_FILE,
    async (_event, request: unknown): Promise<ReadFileResponse> => {
      const validated = ReadFileRequestSchema.parse(request);
      return await fsBrokerService.readFile(validated.path);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FS_WRITE_FILE,
    async (_event, request: unknown): Promise<void> => {
      const validated = WriteFileRequestSchema.parse(request);
      await fsBrokerService.writeFile(validated.path, validated.content);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FS_CREATE_FILE,
    async (_event, request: unknown): Promise<void> => {
      const validated = CreateFileRequestSchema.parse(request);
      await fsBrokerService.createFile(validated.path, validated.content);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FS_CREATE_DIRECTORY,
    async (_event, request: unknown): Promise<void> => {
      const validated = CreateDirectoryRequestSchema.parse(request);
      await fsBrokerService.createDirectory(validated.path);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FS_RENAME,
    async (_event, request: unknown): Promise<void> => {
      const validated = RenameRequestSchema.parse(request);
      await fsBrokerService.rename(validated.oldPath, validated.newPath);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FS_DELETE,
    async (_event, request: unknown): Promise<void> => {
      const validated = DeleteRequestSchema.parse(request);
      await fsBrokerService.delete(validated.path);
    }
  );
};
