import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchPanel } from './SearchPanel';

const mockUseFileTree = vi.fn();

vi.mock('../explorer/FileTreeContext', () => ({
  useFileTree: () => mockUseFileTree(),
}));

const mockQuery = vi.fn();
const mockReplace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.api = {
    search: {
      query: mockQuery,
      replace: mockReplace,
    },
  };
});

describe('SearchPanel', () => {
  it('shows empty state when no workspace is open', () => {
    mockUseFileTree.mockReturnValue({
      workspace: null,
      openFile: vi.fn(),
    });

    render(<SearchPanel />);

    expect(screen.getByText('Open a workspace to search files.')).toBeInTheDocument();
  });

  it('runs search and renders results', async () => {
    mockUseFileTree.mockReturnValue({
      workspace: { path: '/workspace', name: 'workspace' },
      openFile: vi.fn(),
    });

    mockQuery.mockResolvedValue({
      results: [
        {
          filePath: '/workspace/src/app.ts',
          matches: [
            {
              filePath: '/workspace/src/app.ts',
              line: 4,
              column: 7,
              lineText: 'const foo = 1;',
              matchText: 'foo',
            },
          ],
        },
      ],
      truncated: false,
    });

    render(<SearchPanel />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'foo' },
    });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalled();
    });

    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('const foo = 1;')).toBeInTheDocument();
  });
});
