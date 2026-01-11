import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  AgentConversation,
  AgentContextAttachment,
  AgentDraft,
  AgentEvent,
  AgentMessage,
  Result,
} from 'packages-api-contracts';
import { useConnectionsContext } from '../contexts/ConnectionsContext';
import { describeMissingConnection, resolveAgentConnection } from '../utils/agentConnections';

type DraftState = {
  draft: AgentDraft;
  saved: boolean;
};

type UseAgentDraftsOptions = {
  messages: AgentMessage[];
  selectedConversationId: string | null;
  appendMessage: (
    content: string,
    role: AgentMessage['role'],
    conversationId?: string,
    attachments?: AgentContextAttachment[],
    format?: AgentMessage['format']
  ) => Promise<void>;
  createConversation: (title?: string) => Promise<string | null>;
  getConversation: (conversationId: string) => AgentConversation | null;
  onError: (message: string | null) => void;
};

type UseAgentDraftsResult = {
  draft: DraftState | null;
  activeDraftRunId: string | null;
  isSavingDraft: boolean;
  startDraft: (featureId: string, prompt: string) => Promise<void>;
  saveDraft: (allowOverwrite?: boolean) => Promise<void>;
  handleAgentEvent: (event: AgentEvent) => void;
};

const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.error?.message ?? 'Request failed');
  }
  return result.value;
};

const buildHistorySnapshot = (messages: AgentMessage[]) =>
  messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));

export function useAgentDrafts({
  messages,
  selectedConversationId,
  appendMessage,
  createConversation,
  getConversation,
  onError,
}: UseAgentDraftsOptions): UseAgentDraftsResult {
  const { requestSecretAccess } = useConnectionsContext();
  const [draftsByConversation, setDraftsByConversation] = useState<
    Record<string, DraftState>
  >({});
  const [activeDraftRunId, setActiveDraftRunId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const runToConversation = useRef(new Map<string, string>());

  const resolveConversationConnection = useCallback(
    async (conversationId: string) => {
      const [connectionsResponse, settings] = await Promise.all([
        window.api.connections.list(),
        window.api.getSettings(),
      ]);
      const conversation = getConversation(conversationId);
      const resolution = resolveAgentConnection({
        connections: connectionsResponse.connections,
        settings,
        conversation,
      });
      return { ...resolution, connections: connectionsResponse.connections, settings, conversation };
    },
    [getConversation]
  );

  const startDraft = useCallback(
    async (featureId: string, prompt: string) => {
      const conversationId =
        selectedConversationId ?? (await createConversation()) ?? null;
      if (!conversationId) {
        return;
      }

      const trimmedFeatureId = featureId.trim();
      if (!trimmedFeatureId) {
        onError('Enter a feature id before drafting.');
        return;
      }
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        onError('Describe what you want to plan.');
        return;
      }

      try {
        onError(null);
        const historySnapshot = buildHistorySnapshot([
          ...messages,
          {
            id: 'pending',
            conversationId,
            role: 'user',
            format: 'text',
            content: trimmedPrompt,
            createdAt: new Date().toISOString(),
          },
        ]);
        await appendMessage(trimmedPrompt, 'user', conversationId);
        const { connectionId, connections, settings, conversation } =
          await resolveConversationConnection(conversationId);
        if (!connectionId) {
          onError(
            describeMissingConnection({
              connections,
              settings,
              conversation,
            })
          );
          return;
        }

        const access = await requestSecretAccess({
          connectionId,
          requesterId: 'agent-host',
          reason: 'agent.draft',
        });
        if (!access.granted) {
          onError('Secret access denied for this connection.');
          return;
        }
        const response = await window.api.agents.startRun({
          goal: trimmedPrompt,
          inputs: {
            conversationId,
            history: historySnapshot,
          },
          metadata: {
            workflow: 'planning',
            featureId: trimmedFeatureId,
            conversationId,
          },
        });
        runToConversation.current.set(response.run.id, conversationId);
        setActiveDraftRunId(response.run.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start draft run.';
        onError(message);
      }
    },
    [
      appendMessage,
      createConversation,
      messages,
      onError,
      requestSecretAccess,
      resolveConversationConnection,
      selectedConversationId,
    ]
  );

  const saveDraft = useCallback(
    async (allowOverwrite?: boolean) => {
      if (!selectedConversationId) {
        return;
      }
      const draftState = draftsByConversation[selectedConversationId];
      if (!draftState) {
        return;
      }
      setIsSavingDraft(true);
      try {
        onError(null);
        const result = await window.api.agents.saveDraft({
          draft: draftState.draft,
          allowOverwrite,
        });
        unwrapResult(result);
        setDraftsByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: { ...draftState, saved: true },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save draft.';
        onError(message);
      } finally {
        setIsSavingDraft(false);
      }
    },
    [draftsByConversation, onError, selectedConversationId]
  );

  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type !== 'draft') {
        return;
      }
      const conversationId = runToConversation.current.get(event.runId);
      if (!conversationId) {
        return;
      }
      setDraftsByConversation((prev) => ({
        ...prev,
        [conversationId]: { draft: event.draft, saved: false },
      }));
      if (activeDraftRunId === event.runId) {
        setActiveDraftRunId(null);
      }

      if (conversationId === selectedConversationId) {
        void appendMessage(`Draft ready for ${event.draft.featureId}.`, 'agent', conversationId);
      }
    },
    [activeDraftRunId, appendMessage, selectedConversationId]
  );

  const draft = useMemo(() => {
    if (!selectedConversationId) {
      return null;
    }
    return draftsByConversation[selectedConversationId] ?? null;
  }, [draftsByConversation, selectedConversationId]);

  return {
    draft,
    activeDraftRunId,
    isSavingDraft,
    startDraft,
    saveDraft,
    handleAgentEvent,
  };
}
