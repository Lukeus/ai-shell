import { useMemo, useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
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
  const [showDraft, setShowDraft] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = message.trim().length > 0;
  const canDraft = canSend && featureId.trim().length > 0;

  const quickActions = useMemo<QuickAction[]>(
    () => [
      { id: 'explain', label: 'Explain', prompt: 'Explain the selected code and its intent.' },
      { id: 'fix', label: 'Fix', prompt: 'Fix the issue and explain the changes.' },
      { id: 'tests', label: 'Generate Tests', prompt: 'Generate tests for the selected code.', editOptions: { includeTests: true } },
      { id: 'refactor', label: 'Refactor', prompt: 'Refactor the selected code for clarity and maintainability.' },
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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend && !isBusy) {
        void handleSend();
      }
    }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    await onSendMessage(trimmed);
    setMessage('');
    setActiveQuickAction(null);
    setEditOptions(undefined);
  };

  const handleRequestEdit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    await onRequestEdit(trimmed, editOptions);
    setMessage('');
    setActiveQuickAction(null);
    setEditOptions(undefined);
  };

  const handleDraft = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    await onDraftRequest(featureId, trimmed);
    setMessage('');
  };

  return (
    <div className="border-t border-border-subtle px-3 py-3 bg-surface">
      {attachments.length > 0 ? (
        <div className="mb-2">
          <AgentContextChips attachments={attachments} onRemove={onRemoveAttachment} />
        </div>
      ) : null}

      {/* Main input container - Copilot style */}
      <div className="border border-border-subtle rounded-md bg-[var(--vscode-input-background)] focus-within:border-accent transition-colors">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Copilot or type / for commands"
          disabled={isBusy}
          rows={3}
          className="
            w-full bg-transparent text-primary resize-none
            placeholder:text-tertiary
            focus:outline-none
          "
          style={{
            padding: '8px 12px',
            fontSize: 'var(--vscode-font-size-ui)',
            lineHeight: '1.5',
          }}
        />

        {/* Bottom toolbar inside input container */}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void onAttachFile()}
              disabled={isBusy || !canAttachFile}
              className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface-hover disabled:opacity-40"
              title="Attach File"
            >
              <span className="codicon codicon-attach text-[14px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onAttachSelection}
              disabled={isBusy || !canAttachSelection}
              className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface-hover disabled:opacity-40"
              title="Attach Selection"
            >
              <span className="codicon codicon-selection text-[14px]" aria-hidden="true" />
            </button>
            <span className="mx-1 w-px h-4 bg-border-subtle" />
            <button
              type="button"
              onClick={() => setShowDraft(!showDraft)}
              className={`p-1 rounded text-tertiary hover:text-primary hover:bg-surface-hover ${showDraft ? 'text-accent' : ''}`}
              title="Draft Spec/Plan/Tasks"
            >
              <span className="codicon codicon-file-code text-[14px]" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleRequestEdit()}
              disabled={isBusy || !canSend}
              className="
                px-2 py-1 rounded text-[11px] font-medium
                text-secondary hover:text-primary hover:bg-surface-hover
                disabled:opacity-40
              "
            >
              Request Edit
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isBusy || !canSend}
              className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface-hover disabled:opacity-40"
              title="Send (Enter)"
            >
              <span className="codicon codicon-send text-[16px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-2 flex flex-wrap gap-1.5">
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
                textareaRef.current?.focus();
              }}
              aria-pressed={isActive}
              className={`
                px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors
                ${isActive
                  ? 'border-accent text-accent bg-surface-hover'
                  : 'border-border-subtle text-secondary hover:text-primary hover:border-border hover:bg-surface-hover'}
              `}
            >
              {action.label}
            </button>
          );
        })}
      </div>

      {/* Draft section - collapsible */}
      {showDraft ? (
        <div className="mt-3 border border-border-subtle rounded-md p-3 bg-surface-secondary">
          <div className="text-[11px] font-medium text-secondary mb-2">Draft Spec / Plan / Tasks</div>
          <input
            type="text"
            value={featureId}
            onChange={(event) => setFeatureId(event.target.value)}
            placeholder="Feature id (e.g., 159-agents-panel-context)"
            className="
              w-full rounded bg-[var(--vscode-input-background)]
              border border-[var(--vscode-input-border)] text-primary
              placeholder:text-tertiary
              focus:outline-none focus:border-accent
            "
            style={{
              height: '28px',
              paddingLeft: '8px',
              paddingRight: '8px',
              fontSize: 'var(--vscode-font-size-ui)',
            }}
          />
          <button
            type="button"
            onClick={() => void handleDraft()}
            disabled={isBusy || !canDraft}
            className="
              mt-2 px-3 py-1 rounded text-[12px] font-medium
              bg-accent text-[var(--vscode-button-foreground)]
              hover:bg-accent-hover
              disabled:opacity-40
            "
          >
            Draft
          </button>
        </div>
      ) : null}
    </div>
  );
}
