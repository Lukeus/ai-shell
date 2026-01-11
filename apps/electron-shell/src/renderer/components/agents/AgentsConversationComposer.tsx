import { useMemo, useState, type ChangeEvent } from 'react';
import type { AgentContextAttachment, AgentEditRequestOptions } from 'packages-api-contracts';
import { AgentContextChips } from './AgentContextChips';

type QuickAction = {
  id: 'explain' | 'fix' | 'tests' | 'refactor';
  label: string;
  prompt: string;
  editOptions?: AgentEditRequestOptions;
};

type AgentsConversationComposerProps = {
  isBusy: boolean;
  attachments: AgentContextAttachment[];
  canAttachFile: boolean;
  canAttachSelection: boolean;
  onAttachFile: () => Promise<void>;
  onAttachSelection: () => void;
  onRemoveAttachment: (index: number) => void;
  onSendMessage: (content: string) => Promise<void>;
  onRequestEdit: (content: string, options?: AgentEditRequestOptions) => Promise<void>;
  onDraftRequest: (featureId: string, prompt: string) => Promise<void>;
};

export function AgentsConversationComposer({
  isBusy,
  attachments,
  canAttachFile,
  canAttachSelection,
  onAttachFile,
  onAttachSelection,
  onRemoveAttachment,
  onSendMessage,
  onRequestEdit,
  onDraftRequest,
}: AgentsConversationComposerProps) {
  const [message, setMessage] = useState('');
  const [featureId, setFeatureId] = useState('');
  const [activeQuickAction, setActiveQuickAction] = useState<QuickAction['id'] | null>(null);
  const [editOptions, setEditOptions] = useState<AgentEditRequestOptions | undefined>(undefined);
  const canSend = message.trim().length > 0;
  const canDraft = canSend && featureId.trim().length > 0;

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'explain',
        label: 'Explain',
        prompt: 'Explain the selected code and its intent.',
      },
      {
        id: 'fix',
        label: 'Fix',
        prompt: 'Fix the issue and explain the changes.',
      },
      {
        id: 'tests',
        label: 'Generate tests',
        prompt: 'Generate tests for the selected code.',
        editOptions: { includeTests: true },
      },
      {
        id: 'refactor',
        label: 'Refactor',
        prompt: 'Refactor the selected code for clarity and maintainability.',
      },
    ],
    []
  );

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    if (activeQuickAction) {
      setActiveQuickAction(null);
      setEditOptions(undefined);
    }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    await onSendMessage(trimmed);
    setMessage('');
    setActiveQuickAction(null);
    setEditOptions(undefined);
  };

  const handleRequestEdit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    await onRequestEdit(trimmed, editOptions);
    setMessage('');
    setActiveQuickAction(null);
    setEditOptions(undefined);
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
    <div className="border-t border-border-subtle px-4 py-4 bg-surface-secondary">
      <div className="flex items-center justify-between">
        <div className="uppercase text-secondary text-[11px] tracking-wide">
          Copilot chat
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onAttachFile()}
            disabled={isBusy || !canAttachFile}
            className="
              rounded-none uppercase tracking-wide
              border border-border-subtle text-secondary
              hover:text-primary hover:border-border
              disabled:opacity-60
            "
            style={{
              paddingLeft: 'var(--vscode-space-2)',
              paddingRight: 'var(--vscode-space-2)',
              paddingTop: 'var(--vscode-space-1)',
              paddingBottom: 'var(--vscode-space-1)',
              fontSize: '10px',
            }}
          >
            Attach file
          </button>
          <button
            type="button"
            onClick={onAttachSelection}
            disabled={isBusy || !canAttachSelection}
            className="
              rounded-none uppercase tracking-wide
              border border-border-subtle text-secondary
              hover:text-primary hover:border-border
              disabled:opacity-60
            "
            style={{
              paddingLeft: 'var(--vscode-space-2)',
              paddingRight: 'var(--vscode-space-2)',
              paddingTop: 'var(--vscode-space-1)',
              paddingBottom: 'var(--vscode-space-1)',
              fontSize: '10px',
            }}
          >
            Attach selection
          </button>
        </div>
      </div>
      {attachments.length > 0 ? (
        <div className="mt-3">
          <AgentContextChips attachments={attachments} onRemove={onRemoveAttachment} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {quickActions.map((action) => {
          const isActive = action.id === activeQuickAction;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setMessage(action.prompt);
                setActiveQuickAction(action.id);
                setEditOptions(action.editOptions);
              }}
              aria-pressed={isActive}
              className={`
                rounded-none uppercase tracking-wide border
                ${isActive
                  ? 'border-border text-primary bg-surface'
                  : 'border-border-subtle text-secondary hover:text-primary hover:border-border'}
              `}
              style={{
                paddingLeft: 'var(--vscode-space-2)',
                paddingRight: 'var(--vscode-space-2)',
                paddingTop: 'var(--vscode-space-1)',
                paddingBottom: 'var(--vscode-space-1)',
                fontSize: '10px',
              }}
            >
              {action.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={message}
        onChange={handleMessageChange}
        placeholder="Ask for help or request edits..."
        className="
          w-full rounded-none mt-3
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
      <div className="mt-3">
        <div className="flex items-center gap-2">
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
            Send
          </button>
          <button
            type="button"
            onClick={handleRequestEdit}
            disabled={isBusy || !canSend}
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
            Request edit
          </button>
        </div>
      </div>
      <div className="mt-5 border-t border-border-subtle pt-4">
        <div className="uppercase text-secondary text-[10px] tracking-wide">
          Draft spec/plan/tasks
        </div>
        <input
          type="text"
          value={featureId}
          onChange={(event) => setFeatureId(event.target.value)}
          placeholder="Feature id (e.g., 159-agents-panel-context)"
          className="
            w-full rounded-none mt-3
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
