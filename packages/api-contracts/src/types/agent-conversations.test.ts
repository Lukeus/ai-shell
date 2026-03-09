import { describe, expect, it } from 'vitest';
import { AgentConversationProposalEntrySchema } from './agent-conversations';

describe('Agent conversation proposal entry contracts', () => {
  it('defaults lifecycle metadata for pending proposals', () => {
    const entry = AgentConversationProposalEntrySchema.parse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      conversationId: '123e4567-e89b-12d3-a456-426614174001',
      type: 'proposal',
      createdAt: '2024-01-01T00:00:00.000Z',
      proposal: {
        summary: 'Update file.ts',
        mode: 'writes',
        changeSummary: {
          filesChanged: 1,
        },
      },
    });

    expect(entry.state).toBe('pending');
    expect(entry.appliedAt).toBeNull();
    expect(entry.discardedAt).toBeNull();
    expect(entry.failedAt).toBeNull();
  });
});
