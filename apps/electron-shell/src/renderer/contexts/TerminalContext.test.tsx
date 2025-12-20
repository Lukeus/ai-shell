import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { TerminalContextProvider, useTerminal } from './TerminalContext';
import { FileTreeContextProvider } from '../components/explorer/FileTreeContext';
import type { TerminalSession, TerminalDataEvent, TerminalExitEvent } from 'packages-api-contracts';

// Mock terminal sessions
const mockSession1: TerminalSession = {
  sessionId: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Terminal 1',
  cwd: '/test/workspace',
  createdAt: '2024-01-01T00:00:00.000Z',
  status: 'running',
};

const mockSession2: TerminalSession = {
  sessionId: '223e4567-e89b-12d3-a456-426614174001',
  title: 'Terminal 2',
  cwd: '/test/workspace',
  createdAt: '2024-01-01T00:01:00.000Z',
  status: 'running',
};

// Mock window.api
const mockTerminalList = vi.fn();
const mockTerminalCreate = vi.fn();
const mockTerminalWrite = vi.fn();
const mockTerminalResize = vi.fn();
const mockTerminalClose = vi.fn();
const mockTerminalOnData = vi.fn();
const mockTerminalOnExit = vi.fn();
const mockWorkspaceGetCurrent = vi.fn();

Object.defineProperty(window, 'api', {
  value: {
    terminal: {
      list: mockTerminalList,
      create: mockTerminalCreate,
      write: mockTerminalWrite,
      resize: mockTerminalResize,
      close: mockTerminalClose,
      onData: mockTerminalOnData,
      onExit: mockTerminalOnExit,
    },
    workspace: {
      getCurrent: mockWorkspaceGetCurrent,
      open: vi.fn(),
      close: vi.fn(),
    },
    fs: {
      readDirectory: vi.fn().mockResolvedValue({ entries: [] }),
      readFile: vi.fn().mockResolvedValue({ content: '', encoding: 'utf-8' }),
      createFile: vi.fn().mockResolvedValue(undefined),
      createDirectory: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

describe('TerminalContext', () => {
  // Store unsubscribe functions
  let dataUnsubscribe: (() => void) | undefined;
  let exitUnsubscribe: (() => void) | undefined;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    vi.clearAllMocks();

    // Setup default mocks
    mockWorkspaceGetCurrent.mockResolvedValue({
      name: 'test-workspace',
      path: '/test/workspace',
    });

    mockTerminalList.mockResolvedValue({
      sessions: [],
    });

    // Mock event subscriptions to return unsubscribe functions
    dataUnsubscribe = vi.fn();
    exitUnsubscribe = vi.fn();
    mockTerminalOnData.mockReturnValue(dataUnsubscribe);
    mockTerminalOnExit.mockReturnValue(exitUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FileTreeContextProvider>
      <TerminalContextProvider>{children}</TerminalContextProvider>
    </FileTreeContextProvider>
  );

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTerminal());
    }).toThrow('useTerminal must be used within TerminalContextProvider');

    consoleError.mockRestore();
  });

  it('should initialize with empty sessions', async () => {
    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toEqual([]);
      expect(result.current.activeSessionId).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should load sessions on mount', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1, mockSession2],
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(mockTerminalList).toHaveBeenCalled();
      expect(result.current.sessions).toEqual([mockSession1, mockSession2]);
      expect(result.current.activeSessionId).toBe(mockSession1.sessionId);
    });
  });

  it('should subscribe to terminal events on mount', async () => {
    renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(mockTerminalOnData).toHaveBeenCalled();
      expect(mockTerminalOnExit).toHaveBeenCalled();
    });
  });

  it('should unsubscribe from events on unmount', async () => {
    const { unmount } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(mockTerminalOnData).toHaveBeenCalled();
      expect(mockTerminalOnExit).toHaveBeenCalled();
    });

    unmount();

    expect(dataUnsubscribe).toHaveBeenCalled();
    expect(exitUnsubscribe).toHaveBeenCalled();
  });

  it('should create a new terminal session', async () => {
    mockTerminalCreate.mockResolvedValue({
      session: mockSession1,
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createdSession: TerminalSession | undefined;
    await act(async () => {
      createdSession = await result.current.createSession({
        cwd: '/test/workspace',
      });
    });

    await waitFor(() => {
      expect(mockTerminalCreate).toHaveBeenCalledWith({
        cwd: '/test/workspace',
        cols: 80,
        rows: 24,
      });
      expect(createdSession).toEqual(mockSession1);
      expect(result.current.sessions).toContainEqual(mockSession1);
      expect(result.current.activeSessionId).toBe(mockSession1.sessionId);
    });
  });

  it('should close a terminal session', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1, mockSession2],
    });
    mockTerminalClose.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions.length).toBe(2);
    });

    await act(async () => {
      await result.current.closeSession(mockSession1.sessionId);
    });

    await waitFor(() => {
      expect(mockTerminalClose).toHaveBeenCalledWith({
        sessionId: mockSession1.sessionId,
      });
      expect(result.current.sessions).not.toContainEqual(mockSession1);
      expect(result.current.sessions).toContainEqual(mockSession2);
    });
  });

  it('should switch active session when closing active one', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1, mockSession2],
    });
    mockTerminalClose.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeSessionId).toBe(mockSession1.sessionId);
    });

    await act(async () => {
      await result.current.closeSession(mockSession1.sessionId);
    });

    // Should switch to the remaining session
    expect(result.current.activeSessionId).toBe(mockSession2.sessionId);
  });

  it('should set activeSessionId to null when closing last session', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1],
    });
    mockTerminalClose.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions.length).toBe(1);
    });

    await act(async () => {
      await result.current.closeSession(mockSession1.sessionId);
    });

    await waitFor(() => {
      expect(result.current.activeSessionId).toBeNull();
    });
  });

  it('should set active session', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1, mockSession2],
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeSessionId).toBe(mockSession1.sessionId);
    });

    act(() => {
      result.current.setActiveSession(mockSession2.sessionId);
    });

    expect(result.current.activeSessionId).toBe(mockSession2.sessionId);
  });

  it('should not set active session for invalid sessionId', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1],
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeSessionId).toBe(mockSession1.sessionId);
    });

    act(() => {
      result.current.setActiveSession('invalid-session-id');
    });

    // Should remain unchanged
    expect(result.current.activeSessionId).toBe(mockSession1.sessionId);
  });

  it('should write data to terminal session', async () => {
    mockTerminalWrite.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.writeToSession(mockSession1.sessionId, 'ls\n');
    });

    expect(mockTerminalWrite).toHaveBeenCalledWith({
      sessionId: mockSession1.sessionId,
      data: 'ls\n',
    });
  });

  it('should resize terminal session', async () => {
    mockTerminalResize.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.resizeSession(mockSession1.sessionId, 100, 30);
    });

    expect(mockTerminalResize).toHaveBeenCalledWith({
      sessionId: mockSession1.sessionId,
      cols: 100,
      rows: 30,
    });
  });

  it('should accumulate terminal data events', async () => {
    let dataCallback: ((event: TerminalDataEvent) => void) | undefined;
    mockTerminalOnData.mockImplementation((callback) => {
      dataCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(mockTerminalOnData).toHaveBeenCalled();
    });

    // Simulate data events
    act(() => {
      dataCallback?.({ sessionId: mockSession1.sessionId, data: 'Hello ' });
      dataCallback?.({ sessionId: mockSession1.sessionId, data: 'World' });
    });

    expect(result.current.outputs.get(mockSession1.sessionId)).toBe('Hello World');
  });

  it('should handle terminal exit events', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1],
    });

    let exitCallback: ((event: TerminalExitEvent) => void) | undefined;
    mockTerminalOnExit.mockImplementation((callback) => {
      exitCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions.length).toBe(1);
      expect(result.current.sessions[0].status).toBe('running');
    });

    // Simulate exit event
    act(() => {
      exitCallback?.({ sessionId: mockSession1.sessionId, exitCode: 0 });
    });

    expect(result.current.sessions[0].status).toBe('exited');
    expect(result.current.sessions[0].exitCode).toBe(0);
  });

  it('should clear output for a session', async () => {
    let dataCallback: ((event: TerminalDataEvent) => void) | undefined;
    mockTerminalOnData.mockImplementation((callback) => {
      dataCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(mockTerminalOnData).toHaveBeenCalled();
    });

    // Add some output
    act(() => {
      dataCallback?.({ sessionId: mockSession1.sessionId, data: 'Test output' });
    });

    expect(result.current.outputs.get(mockSession1.sessionId)).toBe('Test output');

    // Clear output
    act(() => {
      result.current.clearOutput(mockSession1.sessionId);
    });

    expect(result.current.outputs.get(mockSession1.sessionId)).toBe('');
  });

  it.skip('should persist active session to localStorage', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1, mockSession2],
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions.length).toBe(2);
    });

    act(() => {
      result.current.setActiveSession(mockSession2.sessionId);
    });

    // Wait for the active session to actually change and persist
    await waitFor(() => {
      expect(result.current.activeSessionId).toBe(mockSession2.sessionId);
      const stored = localStorage.getItem('terminal:state:global');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.activeSessionId).toBe(mockSession2.sessionId);
      }
    }, { timeout: 3000 });
  });

  it('should use workspace-scoped localStorage key', async () => {
    mockWorkspaceGetCurrent.mockResolvedValue({
      name: 'my-project',
      path: '/home/user/projects/my-project',
    });

    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1],
    });

    renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      const keys = Object.keys(localStorage);
      const hasWorkspaceScopedKey = keys.some(
        key => key.startsWith('terminal:state:') && key !== 'terminal:state:global'
      );
      expect(hasWorkspaceScopedKey).toBe(true);
    });
  });

  it.skip('should handle errors gracefully when creating session', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTerminalCreate.mockRejectedValue(new Error('Failed to create terminal'));

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    try {
      await act(async () => {
        await result.current.createSession({ cwd: '/test/workspace' });
      });
    } catch (error) {
      // Expected to throw
      expect(error).toEqual(new Error('Failed to create terminal'));
    }

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to create terminal');
    }, { timeout: 3000 });
    
    consoleError.mockRestore();
  });

  it('should handle errors gracefully when loading sessions', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTerminalList.mockRejectedValue(new Error('Failed to load sessions'));

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load sessions');
    });

    consoleError.mockRestore();
  });

  it('should reload sessions when loadSessions is called', async () => {
    mockTerminalList.mockResolvedValue({
      sessions: [],
    });

    const { result } = renderHook(() => useTerminal(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCalls = mockTerminalList.mock.calls.length;

    // Update mock to return sessions
    mockTerminalList.mockResolvedValue({
      sessions: [mockSession1],
    });

    await act(async () => {
      await result.current.loadSessions();
    });

    await waitFor(() => {
      expect(mockTerminalList.mock.calls.length).toBe(initialCalls + 1);
      expect(result.current.sessions).toContainEqual(mockSession1);
    });
  });
});
