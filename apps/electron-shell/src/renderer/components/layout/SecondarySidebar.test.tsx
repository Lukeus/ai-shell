import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SecondarySidebar } from './SecondarySidebar';
import { ConnectionsProvider } from '../../contexts/ConnectionsContext';
import { FileTreeContextProvider } from '../explorer/FileTreeContext';

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
  getSettings: vi.fn(),
  connections: {
    list: vi.fn(),
    listProviders: vi.fn(),
    requestSecretAccess: vi.fn(),
  },
  workspace: {
    getCurrent: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
  fs: {
    readDirectory: vi.fn(),
    writeFile: vi.fn(),
    createFile: vi.fn(),
    createDirectory: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  },
};

const globalWindow = globalThis as unknown as { window: { api: typeof mockApi } };
globalWindow.window = globalWindow.window ?? { api: mockApi };
globalWindow.window.api = mockApi;

describe('SecondarySidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          id: '123e4567-e89b-12d3-a456-426614174000',
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
          id: '123e4567-e89b-12d3-a456-426614174000',
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
    mockApi.connections.list.mockResolvedValue({ connections: [] });
    mockApi.connections.listProviders.mockResolvedValue({ providers: [] });
    mockApi.connections.requestSecretAccess.mockResolvedValue({ granted: true });
    mockApi.workspace.getCurrent.mockResolvedValue(null);
    mockApi.workspace.open.mockResolvedValue(null);
    mockApi.workspace.close.mockResolvedValue(undefined);
    mockApi.fs.readDirectory.mockResolvedValue({ entries: [] });
    mockApi.fs.writeFile.mockResolvedValue(undefined);
    mockApi.fs.createFile.mockResolvedValue(undefined);
    mockApi.fs.createDirectory.mockResolvedValue(undefined);
    mockApi.fs.rename.mockResolvedValue(undefined);
    mockApi.fs.delete.mockResolvedValue(undefined);
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
      agents: { defaultConnectionId: null },
      sdd: { enabled: false, blockCommitOnUntrackedCodeChanges: false, customCommands: [] },
    });
  });

  it('renders the agents header and empty state', async () => {
    render(
      <ConnectionsProvider>
        <FileTreeContextProvider>
          <SecondarySidebar
            width={300}
            collapsed={false}
            onResize={() => undefined}
            onToggleCollapse={() => undefined}
          />
        </FileTreeContextProvider>
      </ConnectionsProvider>
    );

    expect(screen.getByText('Agents')).toBeInTheDocument();

    const runsTab = screen.getByRole('tab', { name: 'Runs' });
    runsTab.click();

    await waitFor(() => {
      expect(screen.getByText('No agent runs yet.')).toBeInTheDocument();
    });
  });
});
