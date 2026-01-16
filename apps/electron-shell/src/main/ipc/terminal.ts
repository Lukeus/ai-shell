import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  CreateTerminalRequestSchema,
  CreateTerminalResponse,
  TerminalWriteRequestSchema,
  TerminalResizeRequestSchema,
  TerminalCloseRequestSchema,
  ListTerminalsResponse,
} from 'packages-api-contracts';
import { terminalService } from '../services/TerminalService';
import { workspaceService } from '../services/WorkspaceService';

export const registerTerminalHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_event, request: unknown): Promise<CreateTerminalResponse> => {
      const validated = CreateTerminalRequestSchema.parse(request);
      const workspace = workspaceService.getWorkspace();
      const workspaceRoot = workspace?.path || null;
      const session = terminalService.createSession(validated, workspaceRoot);
      return { session };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WRITE,
    async (_event, request: unknown): Promise<void> => {
      const validated = TerminalWriteRequestSchema.parse(request);
      terminalService.write(validated.sessionId, validated.data);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_RESIZE,
    async (_event, request: unknown): Promise<void> => {
      const validated = TerminalResizeRequestSchema.parse(request);
      terminalService.resize(validated.sessionId, validated.cols, validated.rows);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CLOSE,
    async (_event, request: unknown): Promise<void> => {
      const validated = TerminalCloseRequestSchema.parse(request);
      terminalService.close(validated.sessionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_LIST,
    async (): Promise<ListTerminalsResponse> => {
      const sessions = terminalService.listSessions();
      return { sessions };
    }
  );
};
