import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { SddPanel } from './SddPanel';

const mockUseFileTree = vi.fn();

vi.mock('../explorer/FileTreeContext', () => ({
  useFileTree: () => mockUseFileTree(),
}));

const mockGetSettings = vi.fn();
const mockListFeatures = vi.fn();
const mockStatus = vi.fn();
const mockOnChange = vi.fn();
const mockReadFile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.api = {
    getSettings: mockGetSettings,
    sdd: {
      listFeatures: mockListFeatures,
      status: mockStatus,
      onChange: mockOnChange,
      setActiveTask: vi.fn(),
      startRun: vi.fn(),
      stopRun: vi.fn(),
      getFileTrace: vi.fn(),
    },
    fs: {
      readFile: mockReadFile,
    },
  };

  mockOnChange.mockReturnValue(() => {});
});

describe('SddPanel', () => {
  it('shows empty state when no workspace is open', async () => {
    mockUseFileTree.mockReturnValue({
      workspace: null,
      openFile: vi.fn(),
      selectedEntry: null,
    });
    mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);

    render(<SddPanel />);

    await waitFor(() => {
      expect(screen.getByText('Open a workspace to view SDD.')).toBeInTheDocument();
    });
  });

  it('shows disabled state when sdd.enabled is false', async () => {
    mockUseFileTree.mockReturnValue({
      workspace: { path: '/workspace', name: 'workspace' },
      openFile: vi.fn(),
      selectedEntry: null,
    });
    mockGetSettings.mockResolvedValue({
      ...SETTINGS_DEFAULTS,
      sdd: {
        ...SETTINGS_DEFAULTS.sdd,
        enabled: false,
      },
    });

    render(<SddPanel />);

    await waitFor(() => {
      expect(
        screen.getByText('SDD is disabled. Enable it in Settings to start tracing.')
      ).toBeInTheDocument();
    });
  });

  it('renders features and tasks when enabled', async () => {
    mockUseFileTree.mockReturnValue({
      workspace: { path: '/workspace', name: 'workspace' },
      openFile: vi.fn(),
      selectedEntry: null,
    });

    mockGetSettings.mockResolvedValue({
      ...SETTINGS_DEFAULTS,
      sdd: {
        ...SETTINGS_DEFAULTS.sdd,
        enabled: true,
      },
    });

    mockStatus.mockResolvedValue({
      activeRun: null,
      parity: {
        trackedFileChanges: 0,
        untrackedFileChanges: 0,
        trackedRatio: 1,
        driftFiles: [],
        staleDocs: [],
      },
    });

    mockListFeatures.mockResolvedValue([
      {
        featureId: '140-sdd',
        specPath: '/workspace/specs/140-sdd/spec.md',
        planPath: '/workspace/specs/140-sdd/plan.md',
        tasksPath: '/workspace/specs/140-sdd/tasks.md',
      },
    ]);

    mockReadFile.mockResolvedValue({
      content: '## Task 1: First Task\n## Task 2: Second Task\n',
    });

    render(<SddPanel />);

    await waitFor(() => {
      expect(screen.getByText('140-sdd')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Task 1: First Task')).toBeInTheDocument();
      expect(screen.getByText('Task 2: Second Task')).toBeInTheDocument();
    });
  });
});
