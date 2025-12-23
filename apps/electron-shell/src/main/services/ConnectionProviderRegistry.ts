import {
  ConnectionProviderSchema,
  type ConnectionProvider,
} from 'packages-api-contracts';

const CORE_PROVIDERS: ConnectionProvider[] = [
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
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local Ollama models',
    fields: [
      {
        id: 'baseUrl',
        label: 'Base URL',
        type: 'string',
        required: true,
        defaultValue: 'http://localhost:11434',
        placeholder: 'http://localhost:11434',
      },
      {
        id: 'model',
        label: 'Default model',
        type: 'string',
        required: true,
        defaultValue: 'llama3',
        placeholder: 'llama3',
        helpText: 'Use the local model name from `ollama list`.',
      },
    ],
  },
];

export class ConnectionProviderRegistry {
  private readonly providers = new Map<string, ConnectionProvider>();

  constructor(initialProviders: ConnectionProvider[] = CORE_PROVIDERS) {
    initialProviders.forEach((provider) => {
      this.register(provider);
    });
  }

  public register(provider: ConnectionProvider): ConnectionProvider {
    const validated = ConnectionProviderSchema.parse(provider);
    this.providers.set(validated.id, validated);
    return validated;
  }

  public registerMany(nextProviders: ConnectionProvider[]): ConnectionProvider[] {
    return nextProviders.map((provider) => this.register(provider));
  }

  public list(): ConnectionProvider[] {
    return Array.from(this.providers.values());
  }
}

export const connectionProviderRegistry = new ConnectionProviderRegistry();
