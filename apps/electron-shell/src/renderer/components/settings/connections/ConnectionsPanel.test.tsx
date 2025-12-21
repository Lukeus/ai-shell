import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConnectionsPanel } from './ConnectionsPanel';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSetSecret = vi.fn();
const mockReplaceSecret = vi.fn();
const mockRequestSecretAccess = vi.fn();

const sampleConnection = {
  metadata: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    providerId: 'openai',
    scope: 'user' as const,
    displayName: 'OpenAI Prod',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    secretRef: 'secret-ref',
  },
  config: {
    endpoint: 'https://api.openai.com',
    model: 'gpt-4o-mini',
  },
};

beforeEach(() => {
  (global as any).window = {
    api: {
      connections: {
        list: mockList,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        setSecret: mockSetSecret,
        replaceSecret: mockReplaceSecret,
        requestSecretAccess: mockRequestSecretAccess,
      },
    },
  };

  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConnectionsPanel', () => {
  it('renders connections list and details', async () => {
    mockList.mockResolvedValue({ connections: [sampleConnection] });

    render(<ConnectionsPanel />);

    expect(await screen.findByText('OpenAI Prod')).toBeInTheDocument();
    expect(screen.getByDisplayValue('OpenAI Prod')).toBeInTheDocument();
    expect(screen.getByText('Connection details')).toBeInTheDocument();
  });

  it('replaces a stored secret from the detail view', async () => {
    mockList.mockResolvedValue({ connections: [sampleConnection] });
    mockReplaceSecret.mockResolvedValue({ secretRef: 'secret-ref' });

    render(<ConnectionsPanel />);

    await screen.findByText('OpenAI Prod');

    const secretInput = screen.getByPlaceholderText('sk-***');
    fireEvent.change(secretInput, { target: { value: 'new-secret' } });

    fireEvent.click(screen.getByRole('button', { name: 'Replace secret' }));

    await waitFor(() => {
      expect(mockReplaceSecret).toHaveBeenCalledWith({
        connectionId: sampleConnection.metadata.id,
        secretValue: 'new-secret',
      });
    });
  });
});
