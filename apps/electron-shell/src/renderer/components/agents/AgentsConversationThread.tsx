import type {
  AgentConversationEntry,
  AgentConversationMessageEntry,
  AgentConversationProposalEntry,
  ApplyAgentEditProposalResponse,
  Proposal,
} from 'packages-api-contracts';
import type { AgentStreamingMessage, AgentStreamingStatus } from '../../hooks/useAgentChatStreaming';
import { AgentContextChips } from './AgentContextChips';
import { AgentEditProposalCard } from './AgentEditProposalCard';
import { AgentMarkdownMessage } from './AgentMarkdownMessage';
import { AgentStreamingIndicator } from './AgentStreamingIndicator';

type AgentsConversationThreadProps = {
  entries: AgentConversationEntry[];
  streamingMessage: AgentStreamingMessage | null;
  streamingStatus: AgentStreamingStatus | null;
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
    'max-w-[85%] rounded-none border border-border-subtle px-3 py-2.5 text-[13px] leading-relaxed';
  if (isUser) {
    return `${bubbleBase} bg-accent text-[var(--vscode-button-foreground)] ml-auto`;
  }
  if (isSystem) {
    return `${bubbleBase} bg-surface text-secondary`;
  }
  return `${bubbleBase} bg-[var(--vscode-input-background)] text-primary`;
};

const renderMessageContent = (
  content: string,
  role: AgentConversationMessageEntry['role'],
  format: AgentConversationMessageEntry['format']
) => {
  if (role === 'agent' && format === 'markdown') {
    return <AgentMarkdownMessage content={content} />;
  }
  return <div className="whitespace-pre-wrap break-words">{content}</div>;
};

const renderMessageEntry = (entry: AgentConversationMessageEntry) => {
  const isUser = entry.role === 'user';
  const bubbleClass = buildMessageBubbleClass(entry.role);
  const attachments = entry.attachments ?? [];
  const attachmentWrapClass = `max-w-[85%] ${isUser ? 'ml-auto' : ''}`;

  return (
    <div key={entry.id} className="flex flex-col gap-2">
      <div className={`text-[11px] uppercase tracking-wide text-secondary ${isUser ? 'text-right' : ''}`}>
        {entry.role} - {formatTimestamp(entry.createdAt)}
      </div>
      <div className="flex flex-col gap-3">
        <div className={bubbleClass}>
          {renderMessageContent(entry.content, entry.role, entry.format)}
        </div>
        {attachments.length > 0 ? (
          <div className={attachmentWrapClass}>
            <AgentContextChips attachments={attachments} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const renderStreamingEntry = (
  streamingMessage: AgentStreamingMessage,
  streamingStatus: AgentStreamingStatus | null
) => {
  const bubbleClass = buildMessageBubbleClass('agent');
  const indicatorClass = streamingMessage.content ? 'mt-2' : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide text-secondary">
        agent - {formatTimestamp(streamingMessage.startedAt)}
      </div>
      <div className="flex flex-col gap-3">
        <div className={bubbleClass}>
          {streamingMessage.content
            ? renderMessageContent(streamingMessage.content, 'agent', streamingMessage.format)
            : null}
          <AgentStreamingIndicator status={streamingStatus} className={indicatorClass} />
        </div>
      </div>
    </div>
  );
};

const renderStreamingStatusOnly = (streamingStatus: AgentStreamingStatus) => {
  const bubbleClass = buildMessageBubbleClass('agent');

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide text-secondary">
        agent - {formatTimestamp(streamingStatus.startedAt)}
      </div>
      <div className="flex flex-col gap-3">
        <div className={bubbleClass}>
          <AgentStreamingIndicator status={streamingStatus} />
        </div>
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
  <div key={entry.id} className="flex flex-col gap-2">
    <div className="text-[11px] uppercase tracking-wide text-secondary">
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
  streamingMessage,
  streamingStatus,
  canApplyProposals,
  isApplying,
  isDiscarded,
  applyResult,
  applyError,
  onApplyProposal,
  onDiscardProposal,
}: AgentsConversationThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
      {streamingMessage ? renderStreamingEntry(streamingMessage, streamingStatus) : null}
      {!streamingMessage && streamingStatus ? renderStreamingStatusOnly(streamingStatus) : null}
    </div>
  );
}
