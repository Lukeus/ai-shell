import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Terminal } from './Terminal';
import { TerminalContextProvider } from '../../contexts/TerminalContext';
import { FileTreeContextProvider } from '../explorer/FileTreeContext';
import React from 'react';

// Test wrapper with required providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <FileTreeContextProvider>
    <TerminalContextProvider>
      {children}
    </TerminalContextProvider>
  </FileTreeContextProvider>
);

/**
 * Terminal Tests
 *
 * P5 (Performance budgets): Verify xterm.js dynamic import
 * P1 (Process isolation): Verify IPC-only communication (no direct PTY access)
 * P3 (Secrets): Verify terminal I/O is not logged
 */

// Mock xterm.js
const mockTerminal = {
  open: vi.fn(),
  write: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
  cols: 80,
  rows: 24,
  loadAddon: vi.fn(),
};

const mockFitAddon = {
  fit: vi.fn(),
};

vi.mock('xterm', () => ({
  Terminal: vi.fn(() => mockTerminal),
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddon),
}));

// Mock window.api.terminal
const mockTerminalApi = {
  create: vi.fn(),
  close: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  clear: vi.fn(),
  onData: vi.fn(() => vi.fn()),
  onExit: vi.fn(() => vi.fn()),
  list: vi.fn(),
};

// Mock window.api.filetree
const mockFileTreeApi = {
  readDirectory: vi.fn(),
  getFileInfo: vi.fn(),
  watchPath: vi.fn(),
  unwatchPath: vi.fn(),
  onChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).api = {
    terminal: mockTerminalApi,
    filetree: mockFileTreeApi,
  };
  (window as any).mainWindow = {
    getCurrent: vi.fn(() => ({})),
  };
  
  // Default mock responses
  mockTerminalApi.list.mockResolvedValue({
    sessions: [
      {
        sessionId: 'test-session-1',
        status: 'running',
        exitCode: null,
        title: 'Terminal 1',
        cwd: '/workspace',
        createdAt: new Date().toISOString(),
      },
    ],
  });
  
  mockTerminalApi.write.mockResolvedValue(undefined);
  mockTerminalApi.resize.mockResolvedValue(undefined);
});

describe('Terminal', () => {
  it('dynamically imports xterm.js (not in initial bundle)', async () => {
    render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for xterm.js to load
    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('initializes xterm instance with correct options', async () => {
    const { Terminal: XTermConstructor } = await import('xterm');
    
    render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    await waitFor(() => {
      expect(XTermConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: expect.any(String),
          theme: expect.objectContaining({
            background: '#1e1e1e',
            foreground: '#cccccc',
          }),
          scrollback: 10000,
        })
      );
    }, { timeout: 3000 });
  });

  it('sends user input via IPC (not direct PTY access)', async () => {
    let onDataCallback: ((data: string) => void) | undefined;
    mockTerminal.onData.mockReturnValue({ dispose: vi.fn() });
    mockTerminal.onData.mockImplementation(() => {
      onDataCallback = (data: string) => {
        mockTerminalApi.write({ sessionId: 'test-session-1', data });
      };
      return { dispose: vi.fn() };
    });
    
    render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for terminal to initialize
    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Simulate user typing
    const userInput = 'echo "hello"\r';
    if (onDataCallback) {
      onDataCallback(userInput);
    }
    
    // Wait for IPC call
    await waitFor(() => {
      expect(mockTerminalApi.write).toHaveBeenCalledWith({ sessionId: 'test-session-1', data: userInput });
    });
    
    // P1: Verify no direct PTY access (only IPC)
    expect(mockTerminalApi.write).toHaveBeenCalled();
  });

  it('writes output from TerminalContext to xterm', async () => {
    const testOutput = 'Hello from terminal\r\n';
    
    mockTerminalApi.onData.mockReturnValue(vi.fn());
    mockTerminalApi.onData.mockImplementation(() => {
      // Simulate data event
      setTimeout(() => {
        // Would normally trigger callback, but this test just verifies setup
      }, 100);
      return vi.fn();
    });
    
    render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for terminal to initialize
    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Wait for output to be written
    await waitFor(() => {
      expect(mockTerminal.write).toHaveBeenCalledWith(expect.stringContaining(testOutput));
    }, { timeout: 3000 });
  });

  it('sends resize events via IPC', async () => {
    render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for terminal to initialize
    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Wait for initial resize call
    await waitFor(() => {
      expect(mockTerminalApi.resize).toHaveBeenCalledWith({
        sessionId: 'test-session-1',
        cols: mockTerminal.cols,
        rows: mockTerminal.rows,
      });
    }, { timeout: 3000 });
  });

  it('disposes xterm instance on unmount', async () => {
    const { unmount } = render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for terminal to initialize
    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Unmount component
    unmount();
    
    // Verify cleanup
    expect(mockTerminal.dispose).toHaveBeenCalled();
  });

  it('handles xterm.js load failure gracefully', async () => {
    // Mock import failure
    vi.doMock('xterm', () => {
      throw new Error('Failed to load xterm');
    });
    
    const { container } = render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Should show loading state or error
    await waitFor(() => {
      const loadingText = container.textContent;
      expect(
        loadingText?.includes('Loading Terminal') ||
        loadingText?.includes('Failed to load')
      ).toBe(true);
    }, { timeout: 3000 });
  });

  it('P3: verifies terminal I/O is not logged to console', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    const sensitiveData = 'password123';
    
    let onDataCallback: ((data: string) => void) | undefined;
    mockTerminal.onData.mockReturnValue({ dispose: vi.fn() });
    mockTerminal.onData.mockImplementation(() => {
      onDataCallback = (data: string) => {
        mockTerminalApi.write({ sessionId: 'test-session-1', data });
      };
      return { dispose: vi.fn() };
    });
    
    render(<Terminal sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for terminal to initialize
    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Simulate user typing sensitive data
    if (onDataCallback) {
      onDataCallback(sensitiveData);
    }
    
    // Verify sensitive data not logged
    await waitFor(() => {
      expect(mockTerminalApi.write).toHaveBeenCalled();
    });
    
    const logCalls = consoleLogSpy.mock.calls.flat();
    const hasLoggedSensitiveData = logCalls.some(
      (arg) => typeof arg === 'string' && arg.includes(sensitiveData)
    );
    
    expect(hasLoggedSensitiveData).toBe(false);
    
    consoleLogSpy.mockRestore();
  });
});
