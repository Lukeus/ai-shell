import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgentContextAttachment,
  AgentConversation,
  AgentConversationEntry,
  AgentDraft,
  AgentEditRequestOptions,
  ApplyAgentEditProposalResponse,
  Proposal,
} from 'packages-api-contracts';
import { useEditorContext } from '../../hooks/useEditorContext';
import { useFileTree } from '../explorer/FileTreeContext';
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
  entries: AgentConversationEntry[];
  draft: DraftState | null;
  isLoading: boolean;
  isSavingDraft: boolean;
  errorMessage: string | null;
  sddEnabled: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => Promise<string | null>;
  onSendMessage: (content: string, attachments: AgentContextAttachment[]) => Promise<void>;
  onRequestEdit: (
    content: string,
    attachments: AgentContextAttachment[],
    options?: AgentEditRequestOptions
  ) => Promise<void>;
  onDraftRequest: (featureId: string, prompt: string) => Promise<void>;
  onSaveDraft: (allowOverwrite?: boolean) => Promise<void>;
  onRunSdd: (draft: AgentDraft, goal: string) => Promise<void>;
  onApplyProposal: (entryId: string, proposal: Proposal, conversationId: string) => Promise<void>;
  onDiscardProposal: (entryId: string) => void;
  isApplyingProposal: (entryId: string) => boolean;
  isProposalDiscarded: (entryId: string) => boolean;
  proposalApplyResult: (entryId: string) => ApplyAgentEditProposalResponse | null;
  proposalApplyError: (entryId: string) => string | null;
};

const isMatchingAttachment = (
  left: AgentContextAttachment,
  right: AgentContextAttachment
) => {
  if (left.kind !== right.kind || left.filePath !== right.filePath) {
    return false;
  }
  if (!left.range && !right.range) {
    return true;
  }
  if (!left.range || !right.range) {
    return false;
  }
  return (
    left.range.startLineNumber === right.range.startLineNumber &&
    left.range.startColumn === right.range.startColumn &&
    left.range.endLineNumber === right.range.endLineNumber &&
    left.range.endColumn === right.range.endColumn
  );
};

export function AgentsConversationsView({
  conversations,
  selectedConversationId,
  entries,
  draft,
  isLoading,
  isSavingDraft,
  errorMessage,
  sddEnabled,
  onSelectConversation,
  onCreateConversation,
  onSendMessage,
  onRequestEdit,
  onDraftRequest,
  onSaveDraft,
  onRunSdd,
  onApplyProposal,
  onDiscardProposal,
  isApplyingProposal,
  isProposalDiscarded,
  proposalApplyResult,
  proposalApplyError,
}: AgentsConversationsViewProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [attachments, setAttachments] = useState<AgentContextAttachment[]>([]);
  const { workspace } = useFileTree();
  const {
    canAttachFile,
    canAttachSelection,
    buildFileAttachment,
    buildSelectionAttachment,
  } = useEditorContext();

  useEffect(() => {
    setAttachments([]);
  }, [selectedConversationId]);

  const canApplyProposals = Boolean(workspace?.path);

  const handleSend = async (content: string) => {
    setIsBusy(true);
    try {
      await onSendMessage(content, attachments);
      setAttachments([]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRequestEdit = async (content: string, options?: AgentEditRequestOptions) => {
    setIsBusy(true);
    try {
      await onRequestEdit(content, attachments, options);
      setAttachments([]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDraft = async (featureId: string, prompt: string) => {
    setIsBusy(true);
    try {
      await onDraftRequest(featureId, prompt);
      setAttachments([]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async (allowOverwrite: boolean) => {
    setIsBusy(true);
    try {
      await onSaveDraft(allowOverwrite);
    } finally {
      setIsBusy(false);
    }
  };

  const addAttachment = useCallback((next: AgentContextAttachment | null) => {
    if (!next) {
      return;
    }
    setAttachments((prev) => {
      if (prev.some((attachment) => isMatchingAttachment(attachment, next))) {
        return prev;
      }
      return [...prev, next];
    });
  }, []);

  const handleAttachFile = useCallback(async () => {
    const attachment = await buildFileAttachment();
    addAttachment(attachment);
  }, [addAttachment, buildFileAttachment]);

  const handleAttachSelection = useCallback(() => {
    const attachment = buildSelectionAttachment();
    addAttachment(attachment);
  }, [addAttachment, buildSelectionAttachment]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const threadProps = useMemo(
    () => ({
      entries,
      canApplyProposals,
      isApplying: isApplyingProposal,
      isDiscarded: isProposalDiscarded,
      applyResult: proposalApplyResult,
      applyError: proposalApplyError,
      onApplyProposal,
      onDiscardProposal,
    }),
    [
      entries,
      canApplyProposals,
      isApplyingProposal,
      isProposalDiscarded,
      proposalApplyResult,
      proposalApplyError,
      onApplyProposal,
      onDiscardProposal,
    ]
  );

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
      <AgentsConversationThread {...threadProps} />
      <AgentsConversationComposer
        isBusy={isBusy}
        attachments={attachments}
        canAttachFile={canAttachFile}
        canAttachSelection={canAttachSelection}
        onAttachFile={handleAttachFile}
        onAttachSelection={handleAttachSelection}
        onRemoveAttachment={handleRemoveAttachment}
        onSendMessage={handleSend}
        onRequestEdit={handleRequestEdit}
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
