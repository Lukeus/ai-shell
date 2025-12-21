import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SecondarySidebar } from './SecondarySidebar';

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
  });

  it('renders the agents header and empty state', async () => {
    render(
      <SecondarySidebar
        width={300}
        collapsed={false}
        onResize={() => undefined}
        onToggleCollapse={() => undefined}
      />
    );

    expect(screen.getByText('Agents')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No agent runs yet.')).toBeInTheDocument();
    });
  });
});
