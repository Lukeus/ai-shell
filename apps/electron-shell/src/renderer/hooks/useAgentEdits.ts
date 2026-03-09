import { useCallback, useMemo, useState } from 'react';
import type {
  AgentConversation,
  AgentContextAttachment,
  AgentEditRequestOptions,
  AgentEvent,
  AgentMessage,
  Proposal,
  Result,
} from 'packages-api-contracts';
import { useConnectionsContext } from '../contexts/ConnectionsContext';
import { describeMissingConnection, resolveAgentConnection } from '../utils/agentConnections';

type UseAgentEditsOptions = {
  selectedConversationId: string | null;
  createConversation: (title?: string) => Promise<string | null>;
  getConversation: (conversationId: string) => AgentConversation | null;
  reloadConversation: (conversationId: string) => Promise<void>;
  appendMessage: (
    content: string,
    role: AgentMessage['role'],
    conversationId?: string,
    attachments?: AgentContextAttachment[],
    format?: AgentMessage['format']
  ) => Promise<void>;
  onError: (message: string | null) => void;
};

type UseAgentEditsResult = {
  activeEditRunId: string | null;
  requestEdit: (
    prompt: string,
    attachments: AgentContextAttachment[],
    options?: AgentEditRequestOptions
  ) => Promise<void>;
  applyProposal: (
    entryId: string,
    conversationId: string,
    proposal?: Proposal
  ) => Promise<void>;
  discardProposal: (entryId: string, conversationId: string) => Promise<void>;
  isApplying: (entryId: string) => boolean;
  handleAgentEvent: (event: AgentEvent) => void;
};

const FINAL_RUN_STATUSES = new Set(['completed', 'failed', 'canceled']);

const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.error?.message ?? 'Request failed');
  }
  return result.value;
};

export function useAgentEdits({
  selectedConversationId,
  createConversation,
  getConversation,
  reloadConversation,
  appendMessage,
  onError,
}: UseAgentEditsOptions): UseAgentEditsResult {
  const { requestSecretAccess } = useConnectionsContext();
  const [activeEditRunId, setActiveEditRunId] = useState<string | null>(null);
  const [applyingEntryIds, setApplyingEntryIds] = useState<Set<string>>(new Set());

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

  const requestEdit = useCallback(
    async (
      prompt: string,
      attachments: AgentContextAttachment[],
      options?: AgentEditRequestOptions
    ) => {
      const conversationId =
        selectedConversationId ?? (await createConversation()) ?? null;
      if (!conversationId) {
        return;
      }

      const trimmed = prompt.trim();
      if (!trimmed) {
        onError('Enter a request before asking for edits.');
        return;
      }

      try {
        onError(null);
        await appendMessage(trimmed, 'user', conversationId, attachments);
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
          reason: 'agent.edit',
        });
        if (!access.granted) {
          onError('Secret access denied for this connection.');
          return;
        }

        const response = await window.api.agents.requestEdit({
          conversationId,
          prompt: trimmed,
          attachments,
          options,
        });
        const data = unwrapResult(response);
        setActiveEditRunId(data.runId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to request edits.';
        onError(message);
      }
    },
    [
      appendMessage,
      createConversation,
      onError,
      requestSecretAccess,
      resolveConversationConnection,
      selectedConversationId,
    ]
  );

  const applyProposal = useCallback(
    async (entryId: string, conversationId: string, proposal?: Proposal) => {
      setApplyingEntryIds((prev) => new Set(prev).add(entryId));

      try {
        onError(null);
        const response = await window.api.agents.applyProposal({
          conversationId,
          entryId,
          proposal,
        });
        unwrapResult(response);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to apply proposal.';
        onError(message);
      } finally {
        try {
          await reloadConversation(conversationId);
        } finally {
          setApplyingEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(entryId);
            return next;
          });
        }
      }
    },
    [onError, reloadConversation]
  );

  const discardProposal = useCallback(
    async (entryId: string, conversationId: string) => {
      setApplyingEntryIds((prev) => new Set(prev).add(entryId));
      try {
        onError(null);
        const response = await window.api.agents.discardProposal({
          conversationId,
          entryId,
        });
        unwrapResult(response);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to discard proposal.';
        onError(message);
      } finally {
        try {
          await reloadConversation(conversationId);
        } finally {
          setApplyingEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(entryId);
            return next;
          });
        }
      }
    },
    [onError, reloadConversation]
  );

  const isApplying = useCallback(
    (entryId: string) => applyingEntryIds.has(entryId),
    [applyingEntryIds]
  );

  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      if (
        event.type === 'status' &&
        event.runId === activeEditRunId &&
        FINAL_RUN_STATUSES.has(event.status)
      ) {
        setActiveEditRunId(null);
      }
    },
    [activeEditRunId]
  );

  return useMemo(
    () => ({
      activeEditRunId,
      requestEdit,
      applyProposal,
      discardProposal,
      isApplying,
      handleAgentEvent,
    }),
    [
      activeEditRunId,
      applyProposal,
      discardProposal,
      handleAgentEvent,
      isApplying,
      requestEdit,
    ]
  );
}
