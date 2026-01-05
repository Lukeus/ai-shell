import { useState } from 'react';

type AgentsConversationComposerProps = {
  isBusy: boolean;
  onSendMessage: (content: string) => Promise<void>;
  onDraftRequest: (featureId: string, prompt: string) => Promise<void>;
};

export function AgentsConversationComposer({
  isBusy,
  onSendMessage,
  onDraftRequest,
}: AgentsConversationComposerProps) {
  const [message, setMessage] = useState('');
  const [featureId, setFeatureId] = useState('');
  const canSend = message.trim().length > 0;
  const canDraft = canSend && featureId.trim().length > 0;

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    await onSendMessage(trimmed);
    setMessage('');
  };

  const handleDraft = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    await onDraftRequest(featureId, trimmed);
    setMessage('');
  };

  return (
    <div className="border-t border-border-subtle px-4 py-3 bg-surface-secondary">
      <div className="uppercase text-secondary text-[11px] tracking-wide">
        Conversation
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Share goals or constraints..."
        className="
          w-full rounded-none mt-2
          bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-primary
          placeholder:text-tertiary
          focus:outline-none focus:ring-1 focus:ring-accent
        "
        style={{
          minHeight: '72px',
          padding: 'var(--vscode-space-2)',
          fontSize: 'var(--vscode-font-size-ui)',
        }}
      />
      <div className="mt-2">
        <div className="uppercase text-secondary text-[10px] tracking-wide">
          Feature Id
        </div>
        <input
          type="text"
          value={featureId}
          onChange={(event) => setFeatureId(event.target.value)}
          placeholder="e.g., 159-agents-panel-context"
          className="
            w-full rounded-none mt-1
            bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-primary
            placeholder:text-tertiary
            focus:outline-none focus:ring-1 focus:ring-accent
          "
          style={{
            height: 'var(--vscode-list-rowHeight)',
            paddingLeft: 'var(--vscode-space-2)',
            paddingRight: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-ui)',
          }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={isBusy || !canSend}
          className="
            rounded-none uppercase tracking-wide
            border border-border-subtle text-secondary
            hover:text-primary hover:border-border
            disabled:opacity-60
          "
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Add note
        </button>
        <button
          type="button"
          onClick={handleDraft}
          disabled={isBusy || !canDraft}
          className="
            rounded-none uppercase tracking-wide
            bg-accent text-[var(--vscode-button-foreground)]
            disabled:opacity-60
          "
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Draft spec/plan/tasks
        </button>
      </div>
    </div>
  );
}
