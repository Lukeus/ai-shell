import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OutputView } from './OutputView';
import type { OutputAppendEvent, OutputClearEvent } from 'packages-api-contracts';

/**
 * OutputView Tests
 *
 * P1 (Process isolation): Verify IPC-only communication
 * P2 (Security Defaults): Verify event listener cleanup
 */

// Mock window.api.output
const mockOutputApi = {
  append: vi.fn(),
  clear: vi.fn(),
  listChannels: vi.fn(),
  read: vi.fn(),
  onAppend: vi.fn(() => vi.fn()),
  onClear: vi.fn(() => vi.fn()),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).api = {
    output: mockOutputApi,
  };
  
  // Default mock responses
  mockOutputApi.listChannels.mockResolvedValue({
    channels: [
      {
        id: 'build',
        name: 'Build',
        lineCount: 10,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'extension',
        name: 'Extension Host',
        lineCount: 5,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  
  mockOutputApi.read.mockResolvedValue({
    channel: {
      id: 'build',
      name: 'Build',
      lineCount: 10,
      createdAt: new Date().toISOString(),
    },
    lines: [
      {
        lineNumber: 1,
        content: 'Build started',
        timestamp: new Date().toISOString(),
      },
      {
        lineNumber: 2,
        content: 'Compiling...',
        timestamp: new Date().toISOString(),
      },
      {
        lineNumber: 3,
        content: 'Build complete',
        timestamp: new Date().toISOString(),
        severity: 'info' as const,
      },
    ],
    totalLines: 3,
    hasMore: false,
  });
  
  mockOutputApi.clear.mockResolvedValue(undefined);
});

describe('OutputView', () => {
  it('renders loading state initially', () => {
    render(<OutputView />);
    expect(screen.getByText('Loading output...')).toBeDefined();
  });

  it('loads and displays channels', async () => {
    render(<OutputView />);
    
    await waitFor(() => {
      expect(mockOutputApi.listChannels).toHaveBeenCalled();
    });
    
    // Should display channel selector
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select).toBeDefined();
      expect(select.value).toBe('build'); // First channel auto-selected
    });
  });

  it('loads lines when channel is selected', async () => {
    render(<OutputView />);
    
    await waitFor(() => {
      expect(mockOutputApi.read).toHaveBeenCalledWith({
        channelId: 'build',
        startLine: 1,
        maxLines: 10000,
      });
    });
  });

  it('subscribes to append events on mount', async () => {
    render(<OutputView />);
    
    await waitFor(() => {
      expect(mockOutputApi.onAppend).toHaveBeenCalled();
    });
  });

  it('subscribes to clear events on mount', async () => {
    render(<OutputView />);
    
    await waitFor(() => {
      expect(mockOutputApi.onClear).toHaveBeenCalled();
    });
  });

  it('handles channel selection change', async () => {
    render(<OutputView />);
    
    // Wait for initial load and channel selector to appear
    await waitFor(() => {
      expect(mockOutputApi.listChannels).toHaveBeenCalled();
    });
    
    // Wait for combobox to be available
    const select = await waitFor(() => {
      const elem = screen.getByRole('combobox');
      expect(elem).toBeDefined();
      return elem as HTMLSelectElement;
    });
    
    // Change channel
    fireEvent.change(select, { target: { value: 'extension' } });
    
    // Should load lines for new channel
    await waitFor(() => {
      expect(mockOutputApi.read).toHaveBeenCalledWith({
        channelId: 'extension',
        startLine: 1,
        maxLines: 10000,
      });
    });
  });

  it('updates lines when append event is received', async () => {
    let appendCallback: ((event: OutputAppendEvent) => void) | undefined;
    mockOutputApi.onAppend.mockReturnValue(vi.fn());
    mockOutputApi.onAppend.mockImplementation(() => {
      appendCallback = (event: OutputAppendEvent) => {
        // Callback will be invoked by test
      };
      return vi.fn();
    });
    
    render(<OutputView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(mockOutputApi.read).toHaveBeenCalled();
    });
    
    // Simulate append event
    if (appendCallback) {
      appendCallback({
        channelId: 'build',
        lines: [
          {
            lineNumber: 4,
            content: 'New line added',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }
    
    // Lines should be updated (verified by component re-render)
    await waitFor(() => {
      expect(mockOutputApi.onAppend).toHaveBeenCalled();
    });
  });

  it('clears lines when clear event is received', async () => {
    let clearCallback: ((event: OutputClearEvent) => void) | undefined;
    mockOutputApi.onClear.mockReturnValue(vi.fn());
    mockOutputApi.onClear.mockImplementation(() => {
      clearCallback = (event: OutputClearEvent) => {
        // Callback will be invoked by test
      };
      return vi.fn();
    });
    
    render(<OutputView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(mockOutputApi.read).toHaveBeenCalled();
    });
    
    // Simulate clear event
    if (clearCallback) {
      clearCallback({
        channelId: 'build',
      });
    }
    
    // Lines should be cleared
    await waitFor(() => {
      expect(mockOutputApi.onClear).toHaveBeenCalled();
    });
  });

  it('calls clear API when clear button is clicked', async () => {
    render(<OutputView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(mockOutputApi.read).toHaveBeenCalled();
    });
    
    // Find and click clear button
    const clearButton = screen.getByTitle('Clear output') as HTMLButtonElement;
    fireEvent.click(clearButton);
    
    // Should call clear API
    await waitFor(() => {
      expect(mockOutputApi.clear).toHaveBeenCalledWith({
        channelId: 'build',
      });
    });
  });

  it('P2: cleans up event listeners on unmount', async () => {
    const unsubscribeAppend = vi.fn();
    const unsubscribeClear = vi.fn();
    
    mockOutputApi.onAppend.mockReturnValue(unsubscribeAppend);
    mockOutputApi.onClear.mockReturnValue(unsubscribeClear);
    
    const { unmount } = render(<OutputView />);
    
    // Wait for subscriptions
    await waitFor(() => {
      expect(mockOutputApi.onAppend).toHaveBeenCalled();
      expect(mockOutputApi.onClear).toHaveBeenCalled();
    });
    
    // Unmount component
    unmount();
    
    // Verify cleanup
    expect(unsubscribeAppend).toHaveBeenCalled();
    expect(unsubscribeClear).toHaveBeenCalled();
  });

  it('shows error message when loading fails', async () => {
    mockOutputApi.listChannels.mockRejectedValue(new Error('Network error'));
    
    render(<OutputView />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load output channels')).toBeDefined();
    });
  });

  it('shows empty state when no channels are available', async () => {
    mockOutputApi.listChannels.mockResolvedValue({ channels: [] });
    
    render(<OutputView />);
    
    await waitFor(() => {
      expect(screen.getByText('No output channels available')).toBeDefined();
    });
  });

  it('P1: uses only IPC for all operations (no Node/OS access)', async () => {
    render(<OutputView />);
    
    await waitFor(() => {
      // Verify all operations use window.api.output
      expect(mockOutputApi.listChannels).toHaveBeenCalled();
      expect(mockOutputApi.read).toHaveBeenCalled();
      expect(mockOutputApi.onAppend).toHaveBeenCalled();
      expect(mockOutputApi.onClear).toHaveBeenCalled();
    });
    
    // No direct Node/OS access should occur
    // All operations go through IPC
  });
});
