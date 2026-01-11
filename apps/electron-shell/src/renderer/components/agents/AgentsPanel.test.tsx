import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentsPanel } from './AgentsPanel';
import { FileTreeContextProvider } from '../explorer/FileTreeContext';
import { ConnectionsProvider } from '../../contexts/ConnectionsContext';

const runId = '123e4567-e89b-12d3-a456-426614174000';

const mockApi = {
  agents: {
    listRuns: vi.fn(),
    getRun: vi.fn(),
    startRun: vi.fn(),
    cancelRun: vi.fn(),
    retryRun: vi.fn(),
    listTrace: vi.fn(),
    subscribeEvents: vi.fn(),
    unsubscribeEvents: vi.fn(),
    onEvent: vi.fn(),
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    appendMessage: vi.fn(),
    saveDraft: vi.fn(),
  },
  workspace: {
    getCurrent: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
  fs: {
    readDirectory: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    createFile: vi.fn(),
    createDirectory: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  },
  connections: {
    list: vi.fn(),
    listProviders: vi.fn(),
    requestSecretAccess: vi.fn(),
  },
  getSettings: vi.fn(),
};

const globalWindow = globalThis as unknown as { window: { api: typeof mockApi } };
globalWindow.window = globalWindow.window ?? { api: mockApi };
globalWindow.window.api = mockApi;

describe('AgentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const defaultConnectionId = '123e4567-e89b-12d3-a456-426614174111';
    const defaultConnection = {
      metadata: {
        id: defaultConnectionId,
        providerId: 'ollama',
        scope: 'user',
        displayName: 'Local Ollama',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      config: {},
    };
    mockApi.agents.listRuns.mockResolvedValue({ runs: [] });
    mockApi.agents.listTrace.mockResolvedValue({ events: [] });
    mockApi.agents.subscribeEvents.mockResolvedValue(undefined);
    mockApi.agents.unsubscribeEvents.mockResolvedValue(undefined);
    mockApi.agents.onEvent.mockImplementation(() => () => undefined);
    mockApi.agents.listConversations.mockResolvedValue({ ok: true, value: { conversations: [] } });
    mockApi.agents.getConversation.mockResolvedValue({
      ok: true,
      value: {
        conversation: {
          id: runId,
          title: 'New Conversation',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        messages: [],
      },
    });
    mockApi.agents.appendMessage.mockResolvedValue({ ok: true, value: { message: null } });
    mockApi.agents.createConversation.mockResolvedValue({
      ok: true,
      value: {
        conversation: {
          id: runId,
          title: 'New Conversation',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    });
    mockApi.agents.saveDraft.mockResolvedValue({
      ok: true,
      value: {
        featureId: '159-agents-panel-context',
        specPath: 'specs/159-agents-panel-context/spec.md',
        planPath: 'specs/159-agents-panel-context/plan.md',
        tasksPath: 'specs/159-agents-panel-context/tasks.md',
        savedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    mockApi.connections.list.mockResolvedValue({ connections: [defaultConnection] });
    mockApi.connections.listProviders.mockResolvedValue({
      providers: [
        {
          id: 'ollama',
          name: 'Ollama',
          fields: [],
        },
      ],
    });
    mockApi.connections.requestSecretAccess.mockResolvedValue({ granted: true });
    mockApi.getSettings.mockResolvedValue({
      appearance: { theme: 'dark', fontSize: 14, iconTheme: 'default', menuBarVisible: true },
      editor: {
        wordWrap: false,
        lineNumbers: true,
        minimap: true,
        breadcrumbsEnabled: true,
        fontSize: 14,
        tabSize: 2,
      },
      terminal: { defaultShell: 'default' },
      extensions: { autoUpdate: true, enableTelemetry: false },
      agents: { defaultConnectionId },
      sdd: { enabled: false, blockCommitOnUntrackedCodeChanges: false, customCommands: [] },
    });
    mockApi.workspace.getCurrent.mockResolvedValue(null);
  });

  const renderAgentsPanel = () =>
    render(
      <ConnectionsProvider>
        <FileTreeContextProvider>
          <AgentsPanel />
        </FileTreeContextProvider>
      </ConnectionsProvider>
    );

  it('renders empty state when no runs exist', async () => {
    renderAgentsPanel();

    const runsTab = screen.getByRole('tab', { name: 'Runs' });
    fireEvent.click(runsTab);

    await waitFor(() => {
      expect(screen.getByText('No agent runs yet.')).toBeInTheDocument();
    });

    expect(mockApi.agents.listRuns).toHaveBeenCalled();
  });

  it('starts a run with the provided goal', async () => {
    const run = {
      id: runId,
      status: 'queued',
      source: 'user',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockApi.agents.listRuns
      .mockResolvedValueOnce({ runs: [] })
      .mockResolvedValue({ runs: [run] });
    mockApi.agents.startRun.mockResolvedValue({ run });

    renderAgentsPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Runs' }));

    const input = screen.getByPlaceholderText('Describe the goal...');
    fireEvent.change(input, { target: { value: 'Analyze repo status' } });
    fireEvent.click(screen.getByText('Start'));

    await waitFor(() => {
      expect(mockApi.agents.startRun).toHaveBeenCalledWith({
        goal: 'Analyze repo status',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Run 123e4567')).toBeInTheDocument();
    });
  });

  it('starts a run with a selected connection', async () => {
    const connectionId = '123e4567-e89b-12d3-a456-426614174111';
    const connection = {
      metadata: {
        id: connectionId,
        providerId: 'ollama',
        scope: 'user',
        displayName: 'Local Ollama',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      config: {},
    };

    const run = {
      id: runId,
      status: 'queued',
      source: 'user',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockApi.connections.list.mockResolvedValue({ connections: [connection] });
    mockApi.agents.listRuns.mockResolvedValue({ runs: [] });
    mockApi.agents.startRun.mockResolvedValue({ run });

    renderAgentsPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Runs' }));

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: connectionId } });

    const input = screen.getByPlaceholderText('Describe the goal...');
    fireEvent.change(input, { target: { value: 'Use Ollama' } });
    fireEvent.click(screen.getByText('Start'));

    await waitFor(() => {
      expect(mockApi.agents.startRun).toHaveBeenCalledWith({
        goal: 'Use Ollama',
        connectionId,
      });
    });
  });
});
