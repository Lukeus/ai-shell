import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTabBar } from './EditorTabBar';
import { FileTreeContextProvider, useFileTree } from '../explorer/FileTreeContext';
import type { Workspace } from 'packages-api-contracts';

// Mock window.api
const mockApi = {
  workspace: {
    getCurrent: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
  fs: {
    readDirectory: vi.fn(),
    createFile: vi.fn(),
    createDirectory: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  },
};

// Set up window.api for jsdom environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = (globalThis as any).window || {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window.api = mockApi;

// Mock localStorage
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value;
  },
  clear: () => {
    localStorageStore = {};
  },
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageStore);
    return keys[index] || null;
  },
};

// Make store keys enumerable via Object.keys(localStorage)
Object.defineProperty(global, 'localStorage', {
  value: new Proxy(localStorageMock, {
    ownKeys() {
      return Object.keys(localStorageStore);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in localStorageStore) {
        return { enumerable: true, configurable: true };
      }
      return Object.getOwnPropertyDescriptor(target, prop);
    },
  }),
  configurable: true,
});

/**
 * Helper: Wrapper component providing FileTreeContext with open tabs.
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <FileTreeContextProvider>{children}</FileTreeContextProvider>;
}

describe('EditorTabBar', () => {
  const mockWorkspace: Workspace = {
    path: '/test/workspace',
    name: 'workspace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApi.workspace.getCurrent.mockResolvedValue(mockWorkspace);
  });

  describe('Empty state', () => {
    it('should render nothing when no tabs are open', () => {
      mockApi.workspace.getCurrent.mockResolvedValue(null);

      const { container } = render(
        <TestWrapper>
          <EditorTabBar />
        </TestWrapper>
      );

      // Should render null when no tabs
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Tab rendering', () => {
    it('should render tabs for open files', async () => {
      const { rerender } = render(
        <TestWrapper>
          <EditorTabBar />
        </TestWrapper>
      );

      // Simulate opening files via context
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/workspace/file1.ts');
          openFile('/test/workspace/file2.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      rerender(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Wait for tabs to appear
      expect(await screen.findByText('file1.ts')).toBeInTheDocument();
      expect(screen.getByText('file2.ts')).toBeInTheDocument();
    });

    it('should display file basename only in tabs', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/very/long/path/to/file/myfile.tsx');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Should show basename, not full path
      expect(await screen.findByText('myfile.tsx')).toBeInTheDocument();
      expect(screen.queryByText('/very/long/path/to/file/myfile.tsx')).not.toBeInTheDocument();
    });

    it('should handle Windows-style paths', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('C:\\Users\\test\\project\\file.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(await screen.findByText('file.ts')).toBeInTheDocument();
    });

    it('should display full path in title attribute', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/workspace/src/file.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const tab = await screen.findByText('file.ts');
      const tabContainer = tab.closest('div');
      expect(tabContainer).toHaveAttribute('title', '/test/workspace/src/file.ts');
    });
  });

  describe('Active tab styling', () => {
    it('should apply accent border to active tab', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const file1Tab = (await screen.findByText('file1.ts')).closest('div');
      const file2Tab = screen.getByText('file2.ts').closest('div');

      // file2.ts should be active (last opened)
      // Check that the borderBottomColor style is set (CSS variable value may not resolve in jsdom)
      expect(file2Tab).toHaveStyle('border-bottom-color: var(--accent-color, #007acc)');
      // Transparent is rendered as rgba(0, 0, 0, 0) in jsdom
      expect(file1Tab).toHaveStyle('border-bottom-color: rgba(0, 0, 0, 0)');
    });

    it('should update active styling when tab is clicked', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      let file1Tab = (await screen.findByText('file1.ts')).closest('div');
      let file2Tab = screen.getByText('file2.ts').closest('div');

      // Initially, file2 is active
      expect(file2Tab).toHaveStyle('border-bottom-color: var(--accent-color, #007acc)');

      // Click file1 tab
      fireEvent.click(file1Tab as HTMLElement);

      // Re-query elements after state change
      file1Tab = screen.getByText('file1.ts').closest('div');
      file2Tab = screen.getByText('file2.ts').closest('div');

      // Now file1 should be active
      expect(file1Tab).toHaveStyle('border-bottom-color: var(--accent-color, #007acc)');
      // Transparent is rendered as rgba(0, 0, 0, 0) in jsdom
      expect(file2Tab).toHaveStyle('border-bottom-color: rgba(0, 0, 0, 0)');
    });
  });

  describe('Tab interactions', () => {
    it('should call setActiveTab when tab is clicked', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const file1Tab = (await screen.findByText('file1.ts')).closest('div');

      // Click should activate the tab
      fireEvent.click(file1Tab as HTMLElement);

      // Verify tab is now active (via styling)
      expect(file1Tab).toHaveStyle('border-bottom-color: var(--accent-color, #007acc)');
    });

    it('should have close button with aria-label', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await screen.findByText('file.ts');
      const closeButton = screen.getByLabelText('Close file.ts');
      expect(closeButton).toBeInTheDocument();
    });

    it('should close tab when close button is clicked', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await screen.findByText('file1.ts');
      expect(screen.getByText('file2.ts')).toBeInTheDocument();

      // Click close button on file1
      const closeButton = screen.getByLabelText('Close file1.ts');
      fireEvent.click(closeButton);

      // file1.ts should be removed
      expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      expect(screen.getByText('file2.ts')).toBeInTheDocument();
    });

    it('should not trigger tab click when close button is clicked', async () => {
      const TestComponent = () => {
        const { openFile, activeTabIndex } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
        }, [openFile]);

        return (
          <>
            <EditorTabBar />
            <div data-testid="active-index">{activeTabIndex}</div>
          </>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await screen.findByText('file1.ts');
      const activeIndex = screen.getByTestId('active-index');

      // Initially active tab is 1 (file2.ts)
      expect(activeIndex).toHaveTextContent('1');

      // Click close button on file1 (index 0)
      const closeButton = screen.getByLabelText('Close file1.ts');
      fireEvent.click(closeButton);

      // Active tab should still be the remaining tab (now index 0), not changed
      // The context logic adjusts activeTabIndex when a tab is closed
      expect(activeIndex).toHaveTextContent('0');
      expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
    });
  });

  describe('Multiple tabs', () => {
    it('should render multiple tabs horizontally', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
          openFile('/test/file3.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(await screen.findByText('file1.ts')).toBeInTheDocument();
      expect(screen.getByText('file2.ts')).toBeInTheDocument();
      expect(screen.getByText('file3.ts')).toBeInTheDocument();

      // Verify they're in a horizontal flex container
      const container = screen.getByText('file1.ts').closest('div')?.parentElement;
      expect(container).toHaveClass('flex');
    });

    it('should close all tabs sequentially', async () => {
      const TestComponent = () => {
        const { openFile } = useFileTree();
        React.useEffect(() => {
          openFile('/test/file1.ts');
          openFile('/test/file2.ts');
        }, [openFile]);
        return <EditorTabBar />;
      };

      const { container } = render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await screen.findByText('file1.ts');

      // Close both tabs
      fireEvent.click(screen.getByLabelText('Close file1.ts'));
      fireEvent.click(screen.getByLabelText('Close file2.ts'));

      // Should render nothing when all tabs closed
      expect(container.firstChild).toBeNull();
    });
  });
});
