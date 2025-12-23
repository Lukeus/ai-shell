import { describe, it, expect } from 'vitest';
import { AgentRunMetadataSchema, AgentRunStartRequestSchema } from './agent-runs';

describe('Agent run contracts', () => {
  it('accepts start requests with or without connectionId', () => {
    const baseRequest = { goal: 'Ship agent run' };
    expect(AgentRunStartRequestSchema.parse(baseRequest)).toEqual(baseRequest);

    const requestWithConnection = {
      goal: 'Run with connection',
      connectionId: '11111111-1111-1111-1111-111111111111',
    };
    expect(AgentRunStartRequestSchema.parse(requestWithConnection)).toEqual(
      requestWithConnection
    );
  });

  it('rejects start requests with non-uuid connectionId', () => {
    const badRequest = {
      goal: 'Invalid connection',
      connectionId: 'not-a-uuid',
    };
    expect(() => AgentRunStartRequestSchema.parse(badRequest)).toThrow();
  });

  it('accepts run metadata with optional routing', () => {
    const now = new Date().toISOString();
    const baseMetadata = {
      id: '22222222-2222-2222-2222-222222222222',
      status: 'queued',
      source: 'user',
      createdAt: now,
      updatedAt: now,
    };
    expect(AgentRunMetadataSchema.parse(baseMetadata)).toEqual(baseMetadata);

    const withRouting = {
      ...baseMetadata,
      routing: {
        connectionId: '33333333-3333-3333-3333-333333333333',
        providerId: 'ollama',
        modelRef: 'llama3',
      },
    };
    expect(AgentRunMetadataSchema.parse(withRouting)).toEqual(withRouting);
  });
});
