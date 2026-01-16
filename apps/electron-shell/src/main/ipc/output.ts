import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  AppendOutputRequestSchema,
  ClearOutputRequestSchema,
  ListOutputChannelsRequestSchema,
  ReadOutputRequestSchema,
  type ListOutputChannelsResponse,
  type OutputAppendEvent,
  type OutputClearEvent,
  type ReadOutputResponse,
} from 'packages-api-contracts';
import { outputService } from '../services/OutputService';

let outputBindingsReady = false;

const publishOutputAppend = (event: OutputAppendEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    const contents = window.webContents;
    if (contents.isDestroyed()) {
      continue;
    }
    try {
      contents.send(IPC_CHANNELS.OUTPUT_ON_APPEND, event);
    } catch {
      // Ignore send failures for closing windows.
    }
  }
};

const publishOutputClear = (event: OutputClearEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    const contents = window.webContents;
    if (contents.isDestroyed()) {
      continue;
    }
    try {
      contents.send(IPC_CHANNELS.OUTPUT_ON_CLEAR, event);
    } catch {
      // Ignore send failures for closing windows.
    }
  }
};

const ensureOutputBindings = (): void => {
  if (outputBindingsReady) {
    return;
  }

  outputService.onAppend((event) => {
    publishOutputAppend(event);
  });

  outputService.onClear((event) => {
    publishOutputClear(event);
  });

  outputBindingsReady = true;
};

export const registerOutputHandlers = (): void => {
  ensureOutputBindings();

  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_APPEND,
    async (_event, request: unknown): Promise<void> => {
      const validated = AppendOutputRequestSchema.parse(request);
      outputService.append(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_CLEAR,
    async (_event, request: unknown): Promise<void> => {
      const validated = ClearOutputRequestSchema.parse(request);
      outputService.clear(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_LIST_CHANNELS,
    async (_event, request: unknown): Promise<ListOutputChannelsResponse> => {
      ListOutputChannelsRequestSchema.parse(request ?? {});
      return outputService.listChannels();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.OUTPUT_READ,
    async (_event, request: unknown): Promise<ReadOutputResponse> => {
      const validated = ReadOutputRequestSchema.parse(request);
      return outputService.read(validated);
    }
  );
};
