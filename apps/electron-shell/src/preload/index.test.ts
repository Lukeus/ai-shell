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

const loadApi = async () => {
  await import('./index');
  const apiCall = exposeInMainWorldMock.mock.calls.find((call) => call[0] === 'api');
  return apiCall?.[1] as {
    menuEvents: {
      onWorkspaceOpen: (handler: () => void) => () => void;
      onWorkspaceClose: (handler: () => void) => () => void;
      onRefreshExplorer: (handler: () => void) => () => void;
      onToggleSecondarySidebar: (handler: () => void) => () => void;
    };
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
    const api = await loadApi();
    const handler = vi.fn();

    const unsubscribe = api.menuEvents.onWorkspaceOpen(handler);
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
    const api = await loadApi();
    const handler = vi.fn();

    api.menuEvents.onWorkspaceOpen(handler);
    const firstWrapped = ipcRendererMock.on.mock.calls[0]?.[1] as (...args: unknown[]) => void;

    api.menuEvents.onWorkspaceOpen(handler);
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
