import type { AgentConversation } from 'packages-api-contracts';

type AgentsConversationListProps = {
  conversations: AgentConversation[];
  selectedConversationId: string | null;
  isLoading: boolean;
  onSelect: (conversationId: string) => void;
  onCreate: () => void;
};

export function AgentsConversationList({
  conversations,
  selectedConversationId,
  isLoading,
  onSelect,
  onCreate,
}: AgentsConversationListProps) {
  return (
    <div className="border-b border-border-subtle">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-secondary">
          Conversations
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="
            rounded-none uppercase tracking-wide
            border border-border-subtle text-secondary
            hover:text-primary hover:border-border
          "
          style={{
            paddingLeft: 'var(--vscode-space-2)',
            paddingRight: 'var(--vscode-space-2)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: '10px',
          }}
        >
          New
        </button>
      </div>
      {isLoading ? (
        <div className="px-4 pb-3 text-[13px] text-secondary">Loading conversations...</div>
      ) : conversations.length === 0 ? (
        <div className="px-4 pb-3 text-[13px] text-secondary">No conversations yet.</div>
      ) : (
        <div className="max-h-36 overflow-y-auto space-y-1">
          {conversations.map((conversation) => {
            const isActive = conversation.id === selectedConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 text-left text-[13px]
                  transition-colors duration-150
                  ${isActive ? 'bg-surface-hover text-primary' : 'text-secondary hover:text-primary hover:bg-surface'}
                `}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-[12px]">{conversation.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-secondary">
                    Updated {new Date(conversation.updatedAt).toLocaleTimeString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
