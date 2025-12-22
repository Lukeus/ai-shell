import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SourceControlPanel } from './SourceControlPanel';

const mockUseFileTree = vi.fn();

vi.mock('../explorer/FileTreeContext', () => ({
  useFileTree: () => mockUseFileTree(),
}));

const mockStatus = vi.fn();
const mockStage = vi.fn();
const mockUnstage = vi.fn();
const mockCommit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.api = {
    scm: {
      status: mockStatus,
      stage: mockStage,
      unstage: mockUnstage,
      commit: mockCommit,
    },
  };
});

describe('SourceControlPanel', () => {
  it('shows empty state when no workspace is open', () => {
    mockUseFileTree.mockReturnValue({
      workspace: null,
      openFile: vi.fn(),
    });

    render(<SourceControlPanel />);

    expect(screen.getByText('Open a workspace to view source control.')).toBeInTheDocument();
  });

  it('renders status groups when workspace is open', async () => {
    mockUseFileTree.mockReturnValue({
      workspace: { path: '/workspace', name: 'workspace' },
      openFile: vi.fn(),
    });

    mockStatus.mockResolvedValue({
      branch: 'main',
      staged: [{ path: '/workspace/staged.txt', status: 'M ' }],
      unstaged: [{ path: '/workspace/unstaged.txt', status: ' M' }],
      untracked: [{ path: '/workspace/untracked.txt', status: '??' }],
    });

    render(<SourceControlPanel />);

    await waitFor(() => {
      expect(screen.getByText('Source Control')).toBeInTheDocument();
    });

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Staged Changes')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText('Untracked')).toBeInTheDocument();
    expect(screen.getByText('staged.txt')).toBeInTheDocument();
  });
});
