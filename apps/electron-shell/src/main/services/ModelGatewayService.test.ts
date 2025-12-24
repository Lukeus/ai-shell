import { describe, it, expect, vi } from 'vitest';
import { ModelGatewayService } from './ModelGatewayService';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\temp'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
  },
}));

const baseConnection = {
  metadata: {
    id: '11111111-1111-1111-1111-111111111111',
    providerId: 'ollama',
    scope: 'user' as const,
    displayName: 'Local Ollama',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  config: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
  },
};

describe('ModelGatewayService', () => {
  it('uses default connection when request omits connectionId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'hello' }),
    });

    const service = new ModelGatewayService({
      getSettings: () => ({
        appearance: { theme: 'dark', fontSize: 14, iconTheme: 'default', menuBarVisible: true },
        editor: { wordWrap: false, lineNumbers: true, minimap: true, breadcrumbsEnabled: true },
        terminal: { defaultShell: 'default' },
        extensions: { autoUpdate: true, enableTelemetry: false },
        agents: { defaultConnectionId: baseConnection.metadata.id },
        sdd: { enabled: false, blockCommitOnUntrackedCodeChanges: false },
      }),
      listConnections: () => [baseConnection],
      evaluateAccess: () => true,
      logSecretAccess: vi.fn(),
      logModelCall: vi.fn(),
      fetchFn: fetchMock,
    });

    const result = await service.generate(
      { prompt: 'Hello' },
      { runId: '22222222-2222-2222-2222-222222222222', requesterId: 'agent-host' }
    );

    expect(result.text).toBe('hello');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects OpenAI requests without consent', async () => {
    const service = new ModelGatewayService({
      getSettings: () => ({
        appearance: { theme: 'dark', fontSize: 14, iconTheme: 'default', menuBarVisible: true },
        editor: { wordWrap: false, lineNumbers: true, minimap: true, breadcrumbsEnabled: true },
        terminal: { defaultShell: 'default' },
        extensions: { autoUpdate: true, enableTelemetry: false },
        agents: { defaultConnectionId: null },
        sdd: { enabled: false, blockCommitOnUntrackedCodeChanges: false },
      }),
      listConnections: () => [
        {
          ...baseConnection,
          metadata: {
            ...baseConnection.metadata,
            id: '33333333-3333-3333-3333-333333333333',
            providerId: 'openai',
            secretRef: 'secret-ref',
          },
          config: {
            endpoint: 'https://api.openai.com',
            model: 'gpt-4o-mini',
          },
        },
      ],
      evaluateAccess: () => false,
      logSecretAccess: vi.fn(),
      logModelCall: vi.fn(),
      fetchFn: vi.fn(),
    });

    await expect(
      service.generate(
        { prompt: 'Hello', connectionId: '33333333-3333-3333-3333-333333333333' },
        { runId: '44444444-4444-4444-4444-444444444444', requesterId: 'agent-host' }
      )
    ).rejects.toThrow('Consent required for OpenAI connection.');
  });
});
