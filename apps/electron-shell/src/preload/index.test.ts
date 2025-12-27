import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from 'packages-api-contracts';

const exposeInMainWorldMock = vi.fn();
const ipcRendererMock = {
  on: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  invoke: vi.fn(),
};

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock,
  },
  ipcRenderer: ipcRendererMock,
}));

const loadPreload = async () => {
  await import('./index');
  const electronCall = exposeInMainWorldMock.mock.calls.find((call) => call[0] === 'electron');
  return electronCall?.[1] as {
    ipcRenderer: {
      on: (channel: string, handler: (...args: unknown[]) => void) => (() => void);
      removeListener: (channel: string, handler: (...args: unknown[]) => void) => void;
    };
  };
};

const loadApi = async () => {
  await import('./index');
  const apiCall = exposeInMainWorldMock.mock.calls.find((call) => call[0] === 'api');
  return apiCall?.[1] as {
    sdd: {
      onChange: (handler: (...args: unknown[]) => void) => () => void;
    };
    sddRuns: {
      onEvent: (handler: (...args: unknown[]) => void) => () => void;
    };
  };
};

describe('preload menu IPC listeners', () => {
  beforeEach(() => {
    vi.resetModules();
    exposeInMainWorldMock.mockClear();
    ipcRendererMock.on.mockClear();
    ipcRendererMock.removeListener.mockClear();
    ipcRendererMock.removeAllListeners.mockClear();
    ipcRendererMock.invoke.mockClear();
  });

  it('returns unsubscribe that removes wrapper listener', async () => {
    const electronApi = await loadPreload();
    const handler = vi.fn();

    const unsubscribe = electronApi.ipcRenderer.on(IPC_CHANNELS.MENU_WORKSPACE_OPEN, handler);
    const wrapped = ipcRendererMock.on.mock.calls[0]?.[1] as (...args: unknown[]) => void;

    expect(wrapped).toBeDefined();
    expect(wrapped).not.toBe(handler);

    unsubscribe();

    expect(ipcRendererMock.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.MENU_WORKSPACE_OPEN,
      wrapped
    );
  });

  it('replaces existing handler wrapper for the same callback', async () => {
    const electronApi = await loadPreload();
    const handler = vi.fn();

    electronApi.ipcRenderer.on(IPC_CHANNELS.MENU_WORKSPACE_OPEN, handler);
    const firstWrapped = ipcRendererMock.on.mock.calls[0]?.[1] as (...args: unknown[]) => void;

    electronApi.ipcRenderer.on(IPC_CHANNELS.MENU_WORKSPACE_OPEN, handler);
    const secondWrapped = ipcRendererMock.on.mock.calls[1]?.[1] as (...args: unknown[]) => void;

    expect(firstWrapped).not.toBe(secondWrapped);
    expect(ipcRendererMock.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.MENU_WORKSPACE_OPEN,
      firstWrapped
    );
  });
});

describe('preload sdd IPC listeners', () => {
  beforeEach(() => {
    vi.resetModules();
    exposeInMainWorldMock.mockClear();
    ipcRendererMock.on.mockClear();
    ipcRendererMock.removeListener.mockClear();
    ipcRendererMock.removeAllListeners.mockClear();
    ipcRendererMock.invoke.mockClear();
  });

  it('returns unsubscribe for SDD change listener', async () => {
    const api = await loadApi();
    const handler = vi.fn();

    const unsubscribe = api.sdd.onChange(handler);
    const wrapped = ipcRendererMock.on.mock.calls[0]?.[1] as (...args: unknown[]) => void;

    expect(wrapped).toBeDefined();
    expect(wrapped).not.toBe(handler);

    unsubscribe();

    expect(ipcRendererMock.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.SDD_CHANGED,
      wrapped
    );
  });

  it('returns unsubscribe for SDD run event listener', async () => {
    const api = await loadApi();
    const handler = vi.fn();

    const unsubscribe = api.sddRuns.onEvent(handler);
    const wrapped = ipcRendererMock.on.mock.calls[0]?.[1] as (...args: unknown[]) => void;

    expect(wrapped).toBeDefined();
    expect(wrapped).not.toBe(handler);

    unsubscribe();

    expect(ipcRendererMock.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.SDD_RUNS_EVENT,
      wrapped
    );
  });
});
