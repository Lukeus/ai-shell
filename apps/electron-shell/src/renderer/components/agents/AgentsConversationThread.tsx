import { useEffect, useRef } from 'react';
import type {
  AgentConversationEntry,
  AgentConversationMessageEntry,
  AgentConversationProposalEntry,
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
  applyResult: (entryId: string) => {
    files: string[];
    summary: AgentConversationProposalEntry['proposal']['changeSummary'];
    state: 'applied';
    appliedAt: string;
  } | null;
  applyError: (entryId: string) => string | null;
  onApplyProposal: (
    entryId: string,
    conversationId: string,
    proposal?: Proposal
  ) => void;
  onDiscardProposal: (entryId: string, conversationId: string) => void;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const getRoleIcon = (role: AgentConversationMessageEntry['role']) => {
  if (role === 'user') return 'codicon-person';
  if (role === 'system') return 'codicon-info';
  return 'codicon-sparkle';
};

const getRoleLabel = (role: AgentConversationMessageEntry['role']) => {
  if (role === 'user') return 'You';
  if (role === 'system') return 'System';
  return 'Copilot';
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
  const icon = getRoleIcon(entry.role);
  const label = getRoleLabel(entry.role);
  const attachments = entry.attachments ?? [];
  const isUser = entry.role === 'user';

  return (
    <div key={entry.id} className="group flex gap-3 px-4 py-3 hover:bg-surface-hover">
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm bg-surface-secondary">
        <span className={`codicon ${icon} text-[14px] ${isUser ? 'text-secondary' : 'text-accent'}`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[13px] font-semibold text-primary">{label}</span>
          <span className="text-[11px] text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTimestamp(entry.createdAt)}
          </span>
        </div>
        <div className="text-[13px] leading-relaxed text-primary">
          {renderMessageContent(entry.content, entry.role, entry.format)}
        </div>
        {attachments.length > 0 ? (
          <div className="mt-2">
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
) => (
  <div className="flex gap-3 px-4 py-3">
    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm bg-surface-secondary">
      <span className="codicon codicon-sparkle text-[14px] text-accent" aria-hidden="true" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[13px] font-semibold text-primary">Copilot</span>
      </div>
      {streamingMessage.content ? (
        <div className="text-[13px] leading-relaxed text-primary">
          {renderMessageContent(streamingMessage.content, 'agent', streamingMessage.format)}
        </div>
      ) : null}
      <AgentStreamingIndicator status={streamingStatus} className={streamingMessage.content ? 'mt-2' : undefined} />
    </div>
  </div>
);

const renderStreamingStatusOnly = (streamingStatus: AgentStreamingStatus) => (
  <div className="flex gap-3 px-4 py-3">
    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm bg-surface-secondary">
      <span className="codicon codicon-sparkle text-[14px] text-accent" aria-hidden="true" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[13px] font-semibold text-primary">Copilot</span>
      </div>
      <AgentStreamingIndicator status={streamingStatus} />
    </div>
  </div>
);

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
  }: Omit<AgentsConversationThreadProps, 'entries' | 'streamingMessage' | 'streamingStatus'>
) => (
  <div key={entry.id} className="flex gap-3 px-4 py-3">
    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm bg-surface-secondary">
      <span className="codicon codicon-edit text-[14px] text-accent" aria-hidden="true" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[13px] font-semibold text-primary">Edit Proposal</span>
        <span className="text-[11px] text-tertiary">
          {formatTimestamp(entry.createdAt)}
        </span>
      </div>
      <AgentEditProposalCard
        entry={entry}
        canApply={canApplyProposals}
        isApplying={isApplying(entry.id)}
        isDiscarded={isDiscarded(entry.id)}
        applyResult={applyResult(entry.id)}
        applyError={applyError(entry.id)}
        onApply={() => onApplyProposal(entry.id, entry.conversationId, entry.proposal.proposal)}
        onDiscard={() => onDiscardProposal(entry.id, entry.conversationId)}
      />
    </div>
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, !!streamingMessage]);

  return (
    <div className="flex-1 overflow-y-auto">
      {entries.length === 0 && !streamingMessage && !streamingStatus ? (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <span className="codicon codicon-sparkle text-[32px] text-tertiary mb-3" aria-hidden="true" />
          <div className="text-[13px] text-secondary mb-1">How can I help you?</div>
          <div className="text-[12px] text-tertiary">
            Ask a question or request an edit to get started.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {entries.map((entry) => {
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
          })}
          {streamingMessage ? renderStreamingEntry(streamingMessage, streamingStatus) : null}
          {!streamingMessage && streamingStatus ? renderStreamingStatusOnly(streamingStatus) : null}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
