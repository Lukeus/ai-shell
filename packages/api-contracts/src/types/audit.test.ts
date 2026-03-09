import { describe, expect, it } from 'vitest';
import { AuditEventSchema } from './audit';

describe('Audit contracts', () => {
  it('accepts agent proposal apply audit events', () => {
    const event = AuditEventSchema.parse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'agent.proposal.apply',
      conversationId: '123e4567-e89b-12d3-a456-426614174001',
      entryId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'success',
      filesChanged: 2,
      files: ['src/a.ts', 'src/b.ts'],
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(event.type).toBe('agent.proposal.apply');
  });

  it('accepts agent proposal discard audit events', () => {
    const event = AuditEventSchema.parse({
      id: '123e4567-e89b-12d3-a456-426614174010',
      type: 'agent.proposal.discard',
      conversationId: '123e4567-e89b-12d3-a456-426614174011',
      entryId: '123e4567-e89b-12d3-a456-426614174012',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(event.type).toBe('agent.proposal.discard');
  });
});
