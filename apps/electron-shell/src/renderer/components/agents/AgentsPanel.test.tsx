import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentsPanel } from './AgentsPanel';

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
  },
  connections: {
    list: vi.fn(),
  },
};

const globalWindow = globalThis as unknown as { window: { api: typeof mockApi } };
globalWindow.window = globalWindow.window ?? { api: mockApi };
globalWindow.window.api = mockApi;

describe('AgentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.agents.listRuns.mockResolvedValue({ runs: [] });
    mockApi.agents.listTrace.mockResolvedValue({ events: [] });
    mockApi.agents.subscribeEvents.mockResolvedValue(undefined);
    mockApi.agents.unsubscribeEvents.mockResolvedValue(undefined);
    mockApi.agents.onEvent.mockImplementation(() => () => undefined);
    mockApi.connections.list.mockResolvedValue({ connections: [] });
  });

  it('renders empty state when no runs exist', async () => {
    render(<AgentsPanel />);

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

    render(<AgentsPanel />);

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

    mockApi.connections.list.mockResolvedValueOnce({ connections: [connection] });
    mockApi.agents.listRuns.mockResolvedValue({ runs: [] });
    mockApi.agents.startRun.mockResolvedValue({ run });

    render(<AgentsPanel />);

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
