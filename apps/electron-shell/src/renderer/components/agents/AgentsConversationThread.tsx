import type {
  AgentConversationEntry,
  AgentConversationMessageEntry,
  AgentConversationProposalEntry,
  ApplyAgentEditProposalResponse,
  Proposal,
} from 'packages-api-contracts';
import { AgentContextChips } from './AgentContextChips';
import { AgentEditProposalCard } from './AgentEditProposalCard';

type AgentsConversationThreadProps = {
  entries: AgentConversationEntry[];
  canApplyProposals: boolean;
  isApplying: (entryId: string) => boolean;
  isDiscarded: (entryId: string) => boolean;
  applyResult: (entryId: string) => ApplyAgentEditProposalResponse | null;
  applyError: (entryId: string) => string | null;
  onApplyProposal: (entryId: string, proposal: Proposal, conversationId: string) => void;
  onDiscardProposal: (entryId: string) => void;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleTimeString();
};

const buildMessageBubbleClass = (role: AgentConversationMessageEntry['role']) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const bubbleBase =
    'max-w-[85%] rounded-none border border-border-subtle px-3 py-2 text-[13px] leading-relaxed';
  if (isUser) {
    return `${bubbleBase} bg-accent text-[var(--vscode-button-foreground)] ml-auto`;
  }
  if (isSystem) {
    return `${bubbleBase} bg-surface text-secondary`;
  }
  return `${bubbleBase} bg-[var(--vscode-input-background)] text-primary`;
};

const renderMessageEntry = (entry: AgentConversationMessageEntry) => {
  const isUser = entry.role === 'user';
  const bubbleClass = buildMessageBubbleClass(entry.role);
  const attachments = entry.attachments ?? [];
  const attachmentWrapClass = `max-w-[85%] ${isUser ? 'ml-auto' : ''}`;

  return (
    <div key={entry.id} className="flex flex-col gap-1">
      <div className={`text-[10px] uppercase tracking-wide text-secondary ${isUser ? 'text-right' : ''}`}>
        {entry.role} - {formatTimestamp(entry.createdAt)}
      </div>
      <div className="flex flex-col gap-2">
        <div className={bubbleClass}>{entry.content}</div>
        {attachments.length > 0 ? (
          <div className={attachmentWrapClass}>
            <AgentContextChips attachments={attachments} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const renderProposalEntry = (
  entry: AgentConversationProposalEntry,
  {
    canApplyProposals,
    isApplying,
    isDiscarded,
    applyResult,
    applyError,
    onApplyProposal,
    onDiscardProposal,
  }: Omit<AgentsConversationThreadProps, 'entries'>
) => (
  <div key={entry.id} className="flex flex-col gap-1">
    <div className="text-[10px] uppercase tracking-wide text-secondary">
      proposal - {formatTimestamp(entry.createdAt)}
    </div>
    <AgentEditProposalCard
      entry={entry}
      canApply={canApplyProposals}
      isApplying={isApplying(entry.id)}
      isDiscarded={isDiscarded(entry.id)}
      applyResult={applyResult(entry.id)}
      applyError={applyError(entry.id)}
      onApply={() => onApplyProposal(entry.id, entry.proposal.proposal, entry.conversationId)}
      onDiscard={() => onDiscardProposal(entry.id)}
    />
  </div>
);

export function AgentsConversationThread({
  entries,
  canApplyProposals,
  isApplying,
  isDiscarded,
  applyResult,
  applyError,
  onApplyProposal,
  onDiscardProposal,
}: AgentsConversationThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {entries.length === 0 ? (
        <div className="text-[13px] text-secondary">
          Start a conversation to capture planning context.
        </div>
      ) : (
        entries.map((entry) => {
          if (entry.type === 'proposal') {
            return renderProposalEntry(entry, {
              canApplyProposals,
              isApplying,
              isDiscarded,
              applyResult,
              applyError,
              onApplyProposal,
              onDiscardProposal,
            });
          }
          return renderMessageEntry(entry);
        })
      )}
    </div>
  );
}
