import type { MouseEvent } from 'react';
import type { AgentConversation } from 'packages-api-contracts';

type AgentsConversationListProps = {
  conversations: AgentConversation[];
  selectedConversationId: string | null;
  isLoading: boolean;
  onSelect: (conversationId: string) => void;
  onCreate: () => void;
  onDelete: (conversationId: string) => void;
};

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export function AgentsConversationList({
  conversations,
  selectedConversationId,
  isLoading,
  onSelect,
  onCreate,
  onDelete,
}: AgentsConversationListProps) {
  const handleDelete = (event: MouseEvent, conversationId: string) => {
    event.stopPropagation();
    onDelete(conversationId);
  };

  return (
    <div className="border-b border-border-subtle">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium text-secondary uppercase tracking-wider">
          Conversations
        </span>
        <button
          type="button"
          onClick={onCreate}
          className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface-hover"
          title="New Conversation"
        >
          <span className="codicon codicon-add text-[14px]" aria-hidden="true" />
        </button>
      </div>
      {isLoading ? (
        <div className="px-3 pb-2 text-[12px] text-tertiary">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="px-3 pb-2 text-[12px] text-tertiary">No conversations yet.</div>
      ) : (
        <div className="max-h-36 overflow-y-auto">
          {conversations.map((conversation) => {
            const isActive = conversation.id === selectedConversationId;
            return (
              <div
                key={conversation.id}
                className={`
                  group w-full flex items-center px-3 py-1.5
                  transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-surface-hover text-primary'
                    : 'text-secondary hover:text-primary hover:bg-surface-hover'}
                `}
                onClick={() => onSelect(conversation.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(conversation.id);
                  }
                }}
              >
                <span className="text-[12px] truncate flex-1 min-w-0">
                  {conversation.title}
                </span>
                <span className="text-[10px] text-tertiary ml-2 flex-shrink-0 group-hover:hidden">
                  {formatRelativeTime(conversation.updatedAt)}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, conversation.id)}
                  className="
                    hidden group-hover:flex p-0.5 ml-1 rounded flex-shrink-0
                    text-tertiary hover:text-error hover:bg-surface-hover
                  "
                  title="Delete Conversation"
                  aria-label={`Delete ${conversation.title}`}
                >
                  <span className="codicon codicon-trash text-[12px]" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
