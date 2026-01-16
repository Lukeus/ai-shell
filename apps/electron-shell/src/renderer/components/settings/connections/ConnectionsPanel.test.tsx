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
const mockListProviders = vi.fn();

const sampleProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI API access',
    fields: [
      {
        id: 'endpoint',
        label: 'Endpoint',
        type: 'string',
        required: true,
        placeholder: 'https://api.openai.com',
      },
      {
        id: 'model',
        label: 'Default model',
        type: 'select',
        required: false,
        options: [
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-4o', label: 'GPT-4o' },
        ],
        defaultValue: 'gpt-4o-mini',
      },
      {
        id: 'organization',
        label: 'Organization ID',
        type: 'string',
        required: false,
        placeholder: 'org_...',
      },
      {
        id: 'apiKey',
        label: 'API key',
        type: 'secret',
        required: true,
        placeholder: 'sk-***',
      },
    ],
  },
];

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
  (globalThis as any).window = (globalThis as any).window || {};
  (window as any).api = {
    connections: {
      listProviders: mockListProviders,
      list: mockList,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      setSecret: mockSetSecret,
      replaceSecret: mockReplaceSecret,
      requestSecretAccess: mockRequestSecretAccess,
    },
  };

  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConnectionsPanel', () => {
  it('renders connections list and details', async () => {
    mockListProviders.mockResolvedValue({ providers: sampleProviders });
    mockList.mockResolvedValue({ connections: [sampleConnection] });

    render(<ConnectionsPanel />);

    expect(await screen.findByText('OpenAI Prod')).toBeInTheDocument();
    expect(screen.getByDisplayValue('OpenAI Prod')).toBeInTheDocument();
    expect(screen.getByText('Connection details')).toBeInTheDocument();
  });

  it('replaces a stored secret from the detail view', async () => {
    mockListProviders.mockResolvedValue({ providers: sampleProviders });
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

  it('validates required fields before allowing create', async () => {
    mockListProviders.mockResolvedValue({ providers: sampleProviders });
    mockList.mockResolvedValue({ connections: [] });

    render(<ConnectionsPanel />);

    await screen.findByText('Connections');

    fireEvent.click(screen.getByRole('button', { name: 'New' }));

    const createButton = screen.getByRole('button', { name: 'Create connection' });
    expect(createButton).toBeDisabled();
    expect(screen.getByText('Required fields: Endpoint')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('https://api.openai.com'), {
      target: { value: 'https://api.openai.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('sk-***'), {
      target: { value: 'new-secret' },
    });

    await waitFor(() => {
      expect(createButton).not.toBeDisabled();
    });
  });
});
