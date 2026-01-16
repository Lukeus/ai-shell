import { IPC_CHANNELS } from 'packages-api-contracts';
import { registerIPCHandlers } from '../ipc-handlers';
import { terminalService } from '../services/TerminalService';
import { getMainWindow } from './window';

const sendToMainWindow = (channel: string, payload: unknown): void => {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send(channel, payload);
};

export const registerMainIpcHandlers = (): void => {
  registerIPCHandlers();
};

export const wireTerminalEvents = (): void => {
  terminalService.on('data', (event) => {
    sendToMainWindow(IPC_CHANNELS.TERMINAL_DATA, event);
  });

  terminalService.on('exit', (event) => {
    sendToMainWindow(IPC_CHANNELS.TERMINAL_EXIT, event);
  });
};
