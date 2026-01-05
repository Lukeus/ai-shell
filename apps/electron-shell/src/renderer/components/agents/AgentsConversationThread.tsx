import type { AgentMessage } from 'packages-api-contracts';

type AgentsConversationThreadProps = {
  messages: AgentMessage[];
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleTimeString();
};

export function AgentsConversationThread({ messages }: AgentsConversationThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 ? (
        <div className="text-[13px] text-secondary">
          Start a conversation to capture planning context.
        </div>
      ) : (
        messages.map((message) => {
          const isUser = message.role === 'user';
          const isSystem = message.role === 'system';
          const bubbleBase =
            'max-w-[85%] rounded-none border border-border-subtle px-3 py-2 text-[13px] leading-relaxed';
          const bubbleClass = isUser
            ? `${bubbleBase} bg-accent text-[var(--vscode-button-foreground)] ml-auto`
            : isSystem
              ? `${bubbleBase} bg-surface text-secondary`
              : `${bubbleBase} bg-[var(--vscode-input-background)] text-primary`;

          return (
            <div key={message.id} className="flex flex-col gap-1">
              <div className={`text-[10px] uppercase tracking-wide text-secondary ${isUser ? 'text-right' : ''}`}>
                {message.role} - {formatTimestamp(message.createdAt)}
              </div>
              <div className={bubbleClass}>{message.content}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
