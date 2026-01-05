import { useCallback, useEffect, useState } from 'react';
import type {
  AgentConversation,
  AgentMessage,
  Result,
} from 'packages-api-contracts';
import { useAgentDrafts } from './useAgentDrafts';

type UseAgentConversationsResult = {
  conversations: AgentConversation[];
  selectedConversationId: string | null;
  messages: AgentMessage[];
  draft: ReturnType<typeof useAgentDrafts>['draft'];
  activeDraftRunId: ReturnType<typeof useAgentDrafts>['activeDraftRunId'];
  isLoading: boolean;
  isSavingDraft: ReturnType<typeof useAgentDrafts>['isSavingDraft'];
  errorMessage: string | null;
  selectConversation: (conversationId: string) => void;
  createConversation: (title?: string) => Promise<string | null>;
  appendMessage: (
    content: string,
    role: AgentMessage['role'],
    conversationId?: string
  ) => Promise<void>;
  startDraft: ReturnType<typeof useAgentDrafts>['startDraft'];
  saveDraft: ReturnType<typeof useAgentDrafts>['saveDraft'];
  handleAgentEvent: ReturnType<typeof useAgentDrafts>['handleAgentEvent'];
};

const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.error?.message ?? 'Request failed');
  }
  return result.value;
};

export function useAgentConversations(): UseAgentConversationsResult {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
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

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    let isActive = true;
    const loadConversation = async () => {
      try {
        const result = await window.api.agents.getConversation({
          conversationId: selectedConversationId,
        });
        const data = unwrapResult(result);
        if (isActive) {
          setMessages(data.messages);
        }
      } catch (error) {
        if (isActive) {
          setMessages([]);
        }
      }
    };

    void loadConversation();

    return () => {
      isActive = false;
    };
  }, [selectedConversationId]);

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
    async (content: string, role: AgentMessage['role'], targetConversationId?: string) => {
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
        });
        const data = unwrapResult(result);
        if (conversationId === selectedConversationId) {
          setMessages((prev) => [...prev, data.message]);
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

  return {
    conversations,
    selectedConversationId,
    messages,
    draft: draftState.draft,
    activeDraftRunId: draftState.activeDraftRunId,
    isLoading,
    isSavingDraft: draftState.isSavingDraft,
    errorMessage,
    selectConversation,
    createConversation,
    appendMessage,
    startDraft: draftState.startDraft,
    saveDraft: draftState.saveDraft,
    handleAgentEvent: draftState.handleAgentEvent,
  };
}
