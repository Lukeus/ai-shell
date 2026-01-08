import { useCallback, useMemo, useState } from 'react';
import type {
  AgentContextAttachment,
  AgentEditRequestOptions,
  AgentEvent,
  AgentMessage,
  ApplyAgentEditProposalResponse,
  Proposal,
  Result,
} from 'packages-api-contracts';

type ApplyState =
  | { status: 'idle' }
  | { status: 'applying' }
  | { status: 'applied'; result: ApplyAgentEditProposalResponse }
  | { status: 'error'; error: string };

type UseAgentEditsOptions = {
  selectedConversationId: string | null;
  createConversation: (title?: string) => Promise<string | null>;
  appendMessage: (
    content: string,
    role: AgentMessage['role'],
    conversationId?: string,
    attachments?: AgentContextAttachment[]
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
  applyProposal: (entryId: string, proposal: Proposal, conversationId?: string) => Promise<void>;
  discardProposal: (entryId: string) => void;
  isApplying: (entryId: string) => boolean;
  isDiscarded: (entryId: string) => boolean;
  applyResult: (entryId: string) => ApplyAgentEditProposalResponse | null;
  applyError: (entryId: string) => string | null;
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
  appendMessage,
  onError,
}: UseAgentEditsOptions): UseAgentEditsResult {
  const [activeEditRunId, setActiveEditRunId] = useState<string | null>(null);
  const [applyStateByEntry, setApplyStateByEntry] = useState<Record<string, ApplyState>>({});
  const [discardedEntries, setDiscardedEntries] = useState<Set<string>>(new Set());

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
    [appendMessage, createConversation, onError, selectedConversationId]
  );

  const applyProposal = useCallback(
    async (entryId: string, proposal: Proposal, conversationId?: string) => {
      setApplyStateByEntry((prev) => ({
        ...prev,
        [entryId]: { status: 'applying' },
      }));

      try {
        onError(null);
        const response = await window.api.agents.applyProposal({
          proposal,
          conversationId,
          entryId,
        });
        const data = unwrapResult(response);
        setApplyStateByEntry((prev) => ({
          ...prev,
          [entryId]: { status: 'applied', result: data },
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to apply proposal.';
        setApplyStateByEntry((prev) => ({
          ...prev,
          [entryId]: { status: 'error', error: message },
        }));
      }
    },
    [onError]
  );

  const discardProposal = useCallback((entryId: string) => {
    setDiscardedEntries((prev) => new Set([...prev, entryId]));
  }, []);

  const isApplying = useCallback(
    (entryId: string) => applyStateByEntry[entryId]?.status === 'applying',
    [applyStateByEntry]
  );

  const isDiscarded = useCallback(
    (entryId: string) => discardedEntries.has(entryId),
    [discardedEntries]
  );

  const applyResult = useCallback(
    (entryId: string) => {
      const state = applyStateByEntry[entryId];
      return state && state.status === 'applied' ? state.result : null;
    },
    [applyStateByEntry]
  );

  const applyError = useCallback(
    (entryId: string) => {
      const state = applyStateByEntry[entryId];
      return state && state.status === 'error' ? state.error : null;
    },
    [applyStateByEntry]
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
      isDiscarded,
      applyResult,
      applyError,
      handleAgentEvent,
    }),
    [
      activeEditRunId,
      applyError,
      applyProposal,
      applyResult,
      discardProposal,
      handleAgentEvent,
      isApplying,
      isDiscarded,
      requestEdit,
    ]
  );
}
