import type {
  AgentConversation,
  AgentConversationEntry,
  AgentConversationProposalEntry,
  AgentMessage,
  Result,
} from 'packages-api-contracts';

export type PersistedProposalApplyResult = {
  files: string[];
  summary: AgentConversationProposalEntry['proposal']['changeSummary'];
  state: 'applied';
  appliedAt: string;
};

export const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.error?.message ?? 'Request failed');
  }
  return result.value;
};

export const toMessageEntry = (message: AgentMessage): AgentConversationEntry => ({
  ...message,
  type: 'message',
});

export const updateConversationTimestamp = (
  conversations: AgentConversation[],
  conversationId: string,
  updatedAt: string
) =>
  conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, updatedAt } : conversation
  );

const findProposalEntry = (
  entries: AgentConversationEntry[],
  entryId: string
): AgentConversationProposalEntry | null =>
  entries.find(
    (entry): entry is AgentConversationProposalEntry =>
      entry.type === 'proposal' && entry.id === entryId
  ) ?? null;

export const isProposalDiscarded = (
  entries: AgentConversationEntry[],
  entryId: string
): boolean => findProposalEntry(entries, entryId)?.state === 'discarded';

export const proposalApplyResult = (
  entries: AgentConversationEntry[],
  entryId: string
): PersistedProposalApplyResult | null => {
  const entry = findProposalEntry(entries, entryId);
  if (!entry || entry.state !== 'applied' || !entry.appliedAt) {
    return null;
  }

  return {
    files: [],
    summary: entry.proposal.changeSummary,
    state: 'applied',
    appliedAt: entry.appliedAt,
  };
};

export const proposalApplyError = (
  entries: AgentConversationEntry[],
  entryId: string
): string | null => {
  const entry = findProposalEntry(entries, entryId);
  if (!entry || entry.state !== 'failed') {
    return null;
  }
  return entry.failureMessage ?? 'Failed to apply proposal.';
};
