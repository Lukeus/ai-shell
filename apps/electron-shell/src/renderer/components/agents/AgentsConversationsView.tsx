import { useState } from 'react';
import type { AgentConversation, AgentDraft, AgentMessage } from 'packages-api-contracts';
import { AgentsConversationList } from './AgentsConversationList';
import { AgentsConversationThread } from './AgentsConversationThread';
import { AgentsConversationComposer } from './AgentsConversationComposer';
import { AgentDraftPreview } from './AgentDraftPreview';

type DraftState = {
  draft: AgentDraft;
  saved: boolean;
};

type AgentsConversationsViewProps = {
  conversations: AgentConversation[];
  selectedConversationId: string | null;
  messages: AgentMessage[];
  draft: DraftState | null;
  isLoading: boolean;
  isSavingDraft: boolean;
  errorMessage: string | null;
  sddEnabled: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => Promise<string | null>;
  onSendMessage: (content: string) => Promise<void>;
  onDraftRequest: (featureId: string, prompt: string) => Promise<void>;
  onSaveDraft: (allowOverwrite?: boolean) => Promise<void>;
  onRunSdd: (draft: AgentDraft, goal: string) => Promise<void>;
};

export function AgentsConversationsView({
  conversations,
  selectedConversationId,
  messages,
  draft,
  isLoading,
  isSavingDraft,
  errorMessage,
  sddEnabled,
  onSelectConversation,
  onCreateConversation,
  onSendMessage,
  onDraftRequest,
  onSaveDraft,
  onRunSdd,
}: AgentsConversationsViewProps) {
  const [isBusy, setIsBusy] = useState(false);

  const handleSend = async (content: string) => {
    setIsBusy(true);
    await onSendMessage(content);
    setIsBusy(false);
  };

  const handleDraft = async (featureId: string, prompt: string) => {
    setIsBusy(true);
    await onDraftRequest(featureId, prompt);
    setIsBusy(false);
  };

  const handleSave = async (allowOverwrite: boolean) => {
    setIsBusy(true);
    await onSaveDraft(allowOverwrite);
    setIsBusy(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      <AgentsConversationList
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        isLoading={isLoading}
        onSelect={onSelectConversation}
        onCreate={() => void onCreateConversation()}
      />
      {errorMessage ? (
        <div className="px-4 py-2 text-[12px] text-error border-b border-border-subtle">
          {errorMessage}
        </div>
      ) : null}
      <AgentsConversationThread messages={messages} />
      <AgentsConversationComposer
        isBusy={isBusy}
        onSendMessage={handleSend}
        onDraftRequest={handleDraft}
      />
      {draft ? (
        <AgentDraftPreview
          draft={draft.draft}
          saved={draft.saved}
          isSaving={isSavingDraft || isBusy}
          sddEnabled={sddEnabled}
          onSave={handleSave}
          onRunSdd={(goal) => onRunSdd(draft.draft, goal)}
        />
      ) : null}
    </div>
  );
}
