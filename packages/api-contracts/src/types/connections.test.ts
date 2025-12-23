import { describe, it, expect } from 'vitest';
import { ListProvidersResponseSchema } from './connections';

describe('Connection provider contracts', () => {
  it('strips unexpected secret data from provider descriptors', () => {
    const response = ListProvidersResponseSchema.parse({
      providers: [
        {
          id: 'ollama',
          name: 'Ollama',
          fields: [],
          secretRef: 'should-not-appear',
        },
      ],
    });

    const provider = response.providers[0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(provider, 'secretRef')).toBe(false);
  });
});
