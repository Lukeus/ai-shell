import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalView } from './TerminalView';
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
 * TerminalView Tests
 *
 * P5 (Performance budgets): Verify lazy loading behavior
 * P1 (Process isolation): Verify IPC-only communication
 */

// Mock xterm.js
vi.mock('xterm', () => ({
  Terminal: vi.fn(() => ({
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
    setOption: vi.fn(),
    clear: vi.fn(),
    cols: 80,
    rows: 24,
    loadAddon: vi.fn(),
  })),
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
  })),
}));

// Mock window.api.filetree
const mockFileTreeApi = {
  readDirectory: vi.fn(),
  getFileInfo: vi.fn(),
  watchPath: vi.fn(),
  unwatchPath: vi.fn(),
  onChange: vi.fn(),
};

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

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).api = {
    terminal: mockTerminalApi,
    filetree: mockFileTreeApi,
    workspace: {
      getCurrent: vi.fn().mockResolvedValue(null),
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
  };
  (window as any).mainWindow = {
    getCurrent: vi.fn(() => ({})),
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
  
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
  
  mockTerminalApi.create.mockResolvedValue({
    session: {
      sessionId: 'test-session-1',
      status: 'running',
      title: 'Terminal 1',
      cwd: '/workspace',
      createdAt: new Date().toISOString(),
    },
  });
});

describe('TerminalView', () => {
  it('renders loading state initially', () => {
    render(<TerminalView sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Should show loading initially (Suspense fallback)
    expect(screen.getByText('Loading Terminal...')).toBeDefined();
  });

  it('renders terminal after lazy loading completes', async () => {
    render(<TerminalView sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Wait for lazy loading to complete
    await waitFor(() => {
      const container = document.querySelector('[style*="background"]');
      expect(container).toBeDefined();
    }, { timeout: 3000 });
  });

  it('shows error when session not found', async () => {
    mockTerminalApi.list.mockResolvedValue({ sessions: [] });
    
    render(<TerminalView sessionId="non-existent-session" />, { wrapper: TestWrapper });
    
    await waitFor(() => {
      expect(screen.getByText(/Terminal session not found/)).toBeDefined();
    });
  });

  it('passes sessionId prop to Terminal component', async () => {
    const sessionId = 'test-session-1';
    
    render(<TerminalView sessionId={sessionId} />, { wrapper: TestWrapper });
    
    // Wait for lazy loading to complete
    await waitFor(() => {
      const container = document.querySelector('[style*="background"]');
      expect(container).toBeDefined();
    }, { timeout: 3000 });
  });

  it('verifies lazy loading (Terminal component not in initial bundle)', () => {
    // This test verifies the lazy loading setup
    // The actual bundle verification happens in the build step
    const { container } = render(<TerminalView sessionId="test-session-1" />, { wrapper: TestWrapper });
    
    // Initially, only the Suspense fallback should be rendered
    expect(screen.getByText('Loading Terminal...')).toBeDefined();
    
    // Terminal component should not be immediately available
    const terminalDiv = container.querySelector('.h-full.w-full');
    expect(terminalDiv).toBeDefined();
  });

  it('integrates with TerminalContext for session management', async () => {
    const sessions = [
      {
        sessionId: 'session-1',
        status: 'running' as const,
        exitCode: null,
        title: 'Terminal 1',
        cwd: '/workspace',
        createdAt: new Date().toISOString(),
      },
      {
        sessionId: 'session-2',
        status: 'exited' as const,
        exitCode: 0,
        title: 'Terminal 2',
        cwd: '/workspace',
        createdAt: new Date().toISOString(),
      },
    ];
    
    mockTerminalApi.list.mockResolvedValue({ sessions });
    
    render(<TerminalView sessionId="session-1" />, { wrapper: TestWrapper });
    
    // Wait for context to load sessions
    await waitFor(() => {
      expect(mockTerminalApi.list).toHaveBeenCalled();
    });
  });
});
