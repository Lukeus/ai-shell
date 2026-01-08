import { useCallback, useEffect, useState } from 'react';
import type {
  AgentConversation,
  AgentConversationEntry,
  AgentEvent,
  AgentMessage,
  AgentContextAttachment,
  Result,
} from 'packages-api-contracts';
import { useAgentDrafts } from './useAgentDrafts';
import { useAgentEdits } from './useAgentEdits';

type UseAgentConversationsResult = {
  conversations: AgentConversation[];
  selectedConversationId: string | null;
  messages: AgentMessage[];
  entries: AgentConversationEntry[];
  draft: ReturnType<typeof useAgentDrafts>['draft'];
  activeDraftRunId: ReturnType<typeof useAgentDrafts>['activeDraftRunId'];
  activeEditRunId: ReturnType<typeof useAgentEdits>['activeEditRunId'];
  isLoading: boolean;
  isSavingDraft: ReturnType<typeof useAgentDrafts>['isSavingDraft'];
  errorMessage: string | null;
  selectConversation: (conversationId: string) => void;
  createConversation: (title?: string) => Promise<string | null>;
  appendMessage: (
    content: string,
    role: AgentMessage['role'],
    conversationId?: string,
    attachments?: AgentContextAttachment[]
  ) => Promise<void>;
  startDraft: ReturnType<typeof useAgentDrafts>['startDraft'];
  saveDraft: ReturnType<typeof useAgentDrafts>['saveDraft'];
  requestEdit: ReturnType<typeof useAgentEdits>['requestEdit'];
  applyProposal: ReturnType<typeof useAgentEdits>['applyProposal'];
  discardProposal: ReturnType<typeof useAgentEdits>['discardProposal'];
  isApplyingProposal: ReturnType<typeof useAgentEdits>['isApplying'];
  isProposalDiscarded: ReturnType<typeof useAgentEdits>['isDiscarded'];
  proposalApplyResult: ReturnType<typeof useAgentEdits>['applyResult'];
  proposalApplyError: ReturnType<typeof useAgentEdits>['applyError'];
  handleAgentEvent: (event: AgentEvent) => void;
};

const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.error?.message ?? 'Request failed');
  }
  return result.value;
};

const toMessageEntry = (message: AgentMessage): AgentConversationEntry => ({
  ...message,
  type: 'message',
});

export function useAgentConversations(): UseAgentConversationsResult {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [entries, setEntries] = useState<AgentConversationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setErrorMessage(null);
      const result = await window.api.agents.listConversations();
      const data = unwrapResult(result);
      setConversations(data.conversations);
      if (!selectedConversationId && data.conversations.length > 0) {
        setSelectedConversationId(data.conversations[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load conversations.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      const result = await window.api.agents.getConversation({ conversationId });
      const data = unwrapResult(result);
      setMessages(data.messages);
      const nextEntries = data.entries?.length ? data.entries : data.messages.map(toMessageEntry);
      setEntries(nextEntries);
    },
    []
  );

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setEntries([]);
      return;
    }

    let isActive = true;
    const load = async () => {
      try {
        await loadConversation(selectedConversationId);
      } catch (error) {
        if (isActive) {
          setMessages([]);
          setEntries([]);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [loadConversation, selectedConversationId]);

  const selectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const createConversation = useCallback(async (title?: string): Promise<string | null> => {
    try {
      setErrorMessage(null);
      const result = await window.api.agents.createConversation({ title });
      const data = unwrapResult(result);
      setConversations((prev) => [data.conversation, ...prev]);
      setSelectedConversationId(data.conversation.id);
      return data.conversation.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create conversation.';
      setErrorMessage(message);
      return null;
    }
  }, []);

  const appendMessage = useCallback(
    async (
      content: string,
      role: AgentMessage['role'],
      targetConversationId?: string,
      attachments?: AgentContextAttachment[]
    ) => {
      const conversationId = targetConversationId ?? selectedConversationId;
      if (!conversationId) {
        return;
      }
      try {
        setErrorMessage(null);
        const result = await window.api.agents.appendMessage({
          conversationId,
          role,
          content,
          attachments,
        });
        const data = unwrapResult(result);
        if (conversationId === selectedConversationId) {
          setMessages((prev) => [...prev, data.message]);
          setEntries((prev) => [...prev, toMessageEntry(data.message)]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to append message.';
        setErrorMessage(message);
      }
    },
    [selectedConversationId]
  );

  const draftState = useAgentDrafts({
    messages,
    selectedConversationId,
    appendMessage,
    createConversation,
    onError: setErrorMessage,
  });

  const editState = useAgentEdits({
    selectedConversationId,
    createConversation,
    appendMessage,
    onError: setErrorMessage,
  });

  const handleAgentEvent = useCallback(
    (event) => {
      draftState.handleAgentEvent(event);
      editState.handleAgentEvent(event);
      if (
        event.type === 'edit-proposal' &&
        event.conversationId &&
        event.conversationId === selectedConversationId
      ) {
        void loadConversation(event.conversationId);
      }
    },
    [draftState, editState, loadConversation, selectedConversationId]
  );

  return {
    conversations,
    selectedConversationId,
    messages,
    entries,
    draft: draftState.draft,
    activeDraftRunId: draftState.activeDraftRunId,
    activeEditRunId: editState.activeEditRunId,
    isLoading,
    isSavingDraft: draftState.isSavingDraft,
    errorMessage,
    selectConversation,
    createConversation,
    appendMessage,
    startDraft: draftState.startDraft,
    saveDraft: draftState.saveDraft,
    requestEdit: editState.requestEdit,
    applyProposal: editState.applyProposal,
    discardProposal: editState.discardProposal,
    isApplyingProposal: editState.isApplying,
    isProposalDiscarded: editState.isDiscarded,
    proposalApplyResult: editState.applyResult,
    proposalApplyError: editState.applyError,
    handleAgentEvent,
  };
}
