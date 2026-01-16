import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SETTINGS_DEFAULTS } from 'packages-api-contracts';
import { ConnectionsProvider } from '../../contexts/ConnectionsContext';
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
const mockConnectionsList = vi.fn();
const mockConnectionsListProviders = vi.fn();
const mockRequestSecretAccess = vi.fn();
const mockSddRunsStart = vi.fn();
const mockSddRunsControl = vi.fn();
const mockSddRunsApply = vi.fn();
const mockSddRunsOnEvent = vi.fn();

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
    sddRuns: {
      start: mockSddRunsStart,
      control: mockSddRunsControl,
      applyProposal: mockSddRunsApply,
      runTests: vi.fn(),
      onEvent: mockSddRunsOnEvent,
    },
    fs: {
      readFile: mockReadFile,
    },
    connections: {
      list: mockConnectionsList,
      listProviders: mockConnectionsListProviders,
      requestSecretAccess: mockRequestSecretAccess,
    },
  };

  mockOnChange.mockReturnValue(() => {});
  mockSddRunsOnEvent.mockReturnValue(() => {});
});

describe('SddPanel', () => {
  const renderPanel = () =>
    render(
      <ConnectionsProvider>
        <SddPanel />
      </ConnectionsProvider>
    );

  it('shows empty state when no workspace is open', async () => {
    mockUseFileTree.mockReturnValue({
      workspace: null,
      openFile: vi.fn(),
      selectedEntry: null,
    });
    mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);

    renderPanel();

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

    renderPanel();

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

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('140-sdd')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Task 1: First Task')).toBeInTheDocument();
      expect(screen.getByText('Task 2: Second Task')).toBeInTheDocument();
    });
  });

  it('requests secret access before starting a workflow run', async () => {
    const connectionId = '123e4567-e89b-12d3-a456-426614174000';

    mockUseFileTree.mockReturnValue({
      workspace: { path: '/workspace', name: 'workspace' },
      openFile: vi.fn(),
      selectedEntry: null,
    });

    mockGetSettings.mockResolvedValue({
      ...SETTINGS_DEFAULTS,
      agents: { defaultConnectionId: connectionId },
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

    mockListFeatures.mockResolvedValue([]);
    mockConnectionsList.mockResolvedValue({
      connections: [
        {
          metadata: {
            id: connectionId,
            providerId: 'azure-openai',
            scope: 'user',
            displayName: 'Azure',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            secretRef: 'secret-ref',
          },
          config: {
            endpoint: 'https://example.openai.azure.com',
            deployment: 'gpt-4o-mini',
          },
        },
      ],
    });
    mockConnectionsListProviders.mockResolvedValue({
      providers: [
        {
          id: 'azure-openai',
          name: 'Azure OpenAI',
          fields: [{ id: 'apiKey', label: 'API key', type: 'secret', required: true }],
        },
      ],
    });
    mockRequestSecretAccess.mockResolvedValue({ granted: true });
    mockSddRunsStart.mockResolvedValue(undefined);

    renderPanel();

    const featureInput = await screen.findByPlaceholderText('151-sdd-workflow');
    fireEvent.change(featureInput, { target: { value: '150-ollama' } });

    const goalInput = screen.getByPlaceholderText(
      'Describe the desired outcome for this workflow.'
    );
    fireEvent.change(goalInput, { target: { value: 'Validate Azure run' } });

    fireEvent.click(screen.getByRole('button', { name: 'Start Workflow' }));

    await waitFor(() => {
      expect(mockRequestSecretAccess).toHaveBeenCalledWith({
        connectionId,
        requesterId: 'agent-host',
        reason: 'sdd.run',
      });
    });

    await waitFor(() => {
      expect(mockSddRunsStart).toHaveBeenCalledWith({
        featureId: '150-ollama',
        goal: 'Validate Azure run',
        step: 'spec',
        connectionId,
      });
    });
  });
});
