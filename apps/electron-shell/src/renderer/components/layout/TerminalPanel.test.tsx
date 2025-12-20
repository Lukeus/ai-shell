import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalPanel } from './TerminalPanel';
import { FileTreeContextProvider } from '../explorer/FileTreeContext';

const mockUseTerminal = vi.fn();

vi.mock('../../contexts/TerminalContext', () => ({
  useTerminal: () => mockUseTerminal(),
}));

vi.mock('../terminal/TerminalSessionTabs', () => ({
  TerminalSessionTabs: ({ className = '' }: { className?: string }) => (
    <div data-testid="terminal-session-tabs" className={className} />
  ),
}));

vi.mock('../terminal/TerminalView', () => ({
  TerminalView: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="terminal-view">{sessionId}</div>
  ),
}));

vi.mock('../output/OutputView', () => ({
  OutputView: ({ className = '' }: { className?: string }) => (
    <div data-testid="output-view" className={className} />
  ),
}));

vi.mock('../problems/ProblemsView', () => ({
  ProblemsView: ({ className = '' }: { className?: string }) => (
    <div data-testid="problems-view" className={className} />
  ),
}));

// Mock window.api
vi.mock('../../../preload/index', () => ({
  default: {},
}));

// Mock window.api.workspace
const mockGetCurrent = vi.fn();
const mockOpen = vi.fn();
const mockClose = vi.fn();

Object.defineProperty(window, 'api', {
  value: {
    workspace: {
      getCurrent: mockGetCurrent,
      open: mockOpen,
      close: mockClose,
    },
    fileSystem: {
      readDirectory: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      createDirectory: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

describe('TerminalPanel', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
    mockUseTerminal.mockReturnValue({
      sessions: [],
      activeSessionId: null,
    });
    
    // Mock workspace
    mockGetCurrent.mockResolvedValue({
      name: 'test-workspace',
      path: '/test/workspace',
    });
  });

  it('should render with tab bar', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Check that all three tabs are rendered
    expect(screen.getByRole('tab', { name: 'Terminal' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Output' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Problems' })).toBeInTheDocument();
  });

  it('should default to Terminal tab', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Terminal tab should be active
    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    expect(terminalTab).toHaveAttribute('aria-selected', 'true');

    // Empty terminal state should be visible
    expect(screen.getByText('No terminal sessions. Click + to create one.')).toBeInTheDocument();
  });

  it('should switch to Output tab when clicked', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Click Output tab
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    // Output tab should be active
    expect(outputTab).toHaveAttribute('aria-selected', 'true');

    // Output view should be visible
    expect(screen.getByTestId('output-view')).toBeInTheDocument();
  });

  it('should switch to Problems tab when clicked', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Click Problems tab
    const problemsTab = screen.getByRole('tab', { name: 'Problems' });
    fireEvent.click(problemsTab);

    // Problems tab should be active
    expect(problemsTab).toHaveAttribute('aria-selected', 'true');

    // Problems view should be visible
    expect(screen.getByTestId('problems-view')).toBeInTheDocument();
  });

  it('should persist active tab to localStorage', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Switch to Output tab
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    // Wait for localStorage to be updated
    await waitFor(() => {
      const stored = localStorage.getItem('bottomPanel:activeTab:global');
      expect(stored).toBe('output');
    });
  });

  it('should load active tab from localStorage', async () => {
    // Pre-populate localStorage
    localStorage.setItem('bottomPanel:activeTab:global', 'problems');

    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Problems tab should be active
    const problemsTab = screen.getByRole('tab', { name: 'Problems' });
    expect(problemsTab).toHaveAttribute('aria-selected', 'true');

    // Problems view should be visible
    expect(screen.getByTestId('problems-view')).toBeInTheDocument();
  });

  it('should scope localStorage key to workspace path', async () => {
    mockGetCurrent.mockResolvedValue({
      name: 'my-project',
      path: '/home/user/projects/my-project',
    });

    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Wait for workspace to load
    await waitFor(() => {
      expect(mockGetCurrent).toHaveBeenCalled();
    });

    // Switch to Output tab
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    // Wait for localStorage to be updated
    await waitFor(() => {
      // Check that a workspace-scoped key was used
      const keys = Object.keys(localStorage);
      const hasWorkspaceScopedKey = keys.some(key => 
        key.startsWith('bottomPanel:activeTab:') && key !== 'bottomPanel:activeTab:global'
      );
      expect(hasWorkspaceScopedKey).toBe(true);
    });
  });

  it('should use global key when no workspace is open', async () => {
    mockGetCurrent.mockResolvedValue(null);

    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Switch to Output tab
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    // Wait for localStorage to be updated
    await waitFor(() => {
      const stored = localStorage.getItem('bottomPanel:activeTab:global');
      expect(stored).toBe('output');
    });
  });

  it('should support keyboard navigation between tabs', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Focus Terminal tab
    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    terminalTab.focus();

    // Press ArrowRight to move to Output tab
    fireEvent.keyDown(terminalTab, { key: 'ArrowRight' });

    // Output tab should be active
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    expect(outputTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should render correct tabpanel with ARIA attributes', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Check tabpanel attributes for Terminal (default)
    const terminalPanel = screen.getByRole('tabpanel');
    expect(terminalPanel).toHaveAttribute('id', 'tabpanel-terminal');
    expect(terminalPanel).toHaveAttribute('aria-labelledby', 'tab-terminal');

    // Switch to Output
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    // Check tabpanel attributes for Output
    const outputPanel = screen.getByRole('tabpanel');
    expect(outputPanel).toHaveAttribute('id', 'tabpanel-output');
    expect(outputPanel).toHaveAttribute('aria-labelledby', 'tab-output');
  });

  it('should handle invalid localStorage data gracefully', async () => {
    // Pre-populate localStorage with invalid data
    localStorage.setItem('bottomPanel:activeTab:global', 'invalid-tab');

    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Should default to Terminal tab
    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    expect(terminalTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage.getItem to throw
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = vi.fn(() => {
      throw new Error('Storage error');
    });

    // Should not crash
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Should still render with default tab
    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    expect(terminalTab).toHaveAttribute('aria-selected', 'true');

    // Restore original
    localStorage.getItem = originalGetItem;
  });

  it('should render empty terminal state when no sessions exist', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Check for Terminal empty state text
    expect(screen.getByText('No terminal sessions. Click + to create one.')).toBeInTheDocument();
  });

  it('should render Output view when Output tab is active', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Switch to Output tab
    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    // Output view should be visible
    expect(screen.getByTestId('output-view')).toBeInTheDocument();
  });

  it('should render Problems view when Problems tab is active', async () => {
    render(
      <FileTreeContextProvider>
        <TerminalPanel />
      </FileTreeContextProvider>
    );

    // Switch to Problems tab
    const problemsTab = screen.getByRole('tab', { name: 'Problems' });
    fireEvent.click(problemsTab);

    // Problems view should be visible
    expect(screen.getByTestId('problems-view')).toBeInTheDocument();
  });
});
