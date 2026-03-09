import { describe, expect, it } from 'vitest';
import {
  AgentEditProposalSchema,
  ApplyAgentEditProposalRequestSchema,
  DiscardAgentEditProposalRequestSchema,
} from './agent-edits';

describe('Agent edit contracts', () => {
  it('accepts proposal metadata without embedded proposal content', () => {
    const proposal = AgentEditProposalSchema.parse({
      summary: 'Update the helper module.',
      mode: 'writes',
      changeSummary: {
        filesChanged: 1,
      },
    });

    expect(proposal.proposal).toBeUndefined();
    expect(proposal.mode).toBe('writes');
  });

  it('rejects mismatched embedded proposal mode metadata', () => {
    expect(() =>
      AgentEditProposalSchema.parse({
        summary: 'Update the helper module.',
        mode: 'writes',
        changeSummary: {
          filesChanged: 1,
        },
        proposal: {
          mode: 'patch',
          patch: 'diff --git a/a.ts b/a.ts',
          summary: {
            filesChanged: 1,
          },
        },
      })
    ).toThrow(/mode/i);
  });

  it('requires a proposal or entry id when applying proposals', () => {
    expect(() =>
      ApplyAgentEditProposalRequestSchema.parse({
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      })
    ).toThrow(/proposal or an entryId/i);
  });

  it('accepts discard requests for persisted entries', () => {
    const request = DiscardAgentEditProposalRequestSchema.parse({
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      entryId: '123e4567-e89b-12d3-a456-426614174001',
    });

    expect(request.entryId).toBe('123e4567-e89b-12d3-a456-426614174001');
  });
});
