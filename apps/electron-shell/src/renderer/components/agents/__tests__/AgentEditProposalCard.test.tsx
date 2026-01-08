import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentEditProposalCard } from '../AgentEditProposalCard';
import type { AgentConversationProposalEntry } from 'packages-api-contracts';

const baseEntry: AgentConversationProposalEntry = {
  id: 'entry-1',
  conversationId: 'conversation-1',
  type: 'proposal',
  createdAt: '2024-01-01T00:00:00.000Z',
  proposal: {
    summary: 'Update file.ts',
    proposal: {
      writes: [{ path: 'src/file.ts', content: 'console.log(1);' }],
      summary: { filesChanged: 1 },
    },
  },
};

describe('AgentEditProposalCard', () => {
  it('fires apply and discard actions', () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();

    render(
      <AgentEditProposalCard
        entry={baseEntry}
        canApply
        isApplying={false}
        isDiscarded={false}
        applyResult={null}
        applyError={null}
        onApply={onApply}
        onDiscard={onDiscard}
      />
    );

    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(screen.getByText('Discard'));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('shows applied state and disables apply', () => {
    render(
      <AgentEditProposalCard
        entry={baseEntry}
        canApply
        isApplying={false}
        isDiscarded={false}
        applyResult={{ files: ['src/file.ts'], summary: { filesChanged: 1 } }}
        applyError={null}
        onApply={() => undefined}
        onDiscard={() => undefined}
      />
    );

    expect(screen.getByText('Applied to 1 files.')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeDisabled();
  });
});
