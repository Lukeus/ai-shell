import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  AgentContextAttachment,
  AgentConversation,
  AgentConversationEntry,
  AgentEvent,
  AgentMessage,
  Connection,
  Settings,
} from 'packages-api-contracts';
import { useConnectionsContext } from '../contexts/ConnectionsContext';
import { describeMissingConnection } from '../utils/agentConnections';

const FINAL_RUN_STATUSES = new Set(['completed', 'failed', 'canceled']);

const buildHistorySnapshot = (messages: AgentMessage[]) =>
  messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));

const unwrapResult = <T,>(result: { ok: boolean; value?: T; error?: { message?: string } }): T => {
  if (!result.ok) {
    throw new Error(result.error?.message ?? 'Request failed');
  }
  return result.value as T;
};

const toMessageEntry = (message: AgentMessage): AgentConversationEntry => ({
  ...message,
  type: 'message',
});

const toMessageFromEvent = (
  event: Extract<AgentEvent, { type: 'message' }> & { conversationId: string }
): AgentMessage => ({
  id: event.messageId ?? event.id,
  conversationId: event.conversationId,
  role: event.role,
  content: event.content,
  createdAt: event.createdAt ?? event.timestamp,
});

const toMessageEntryFromEvent = (
  event: Extract<AgentEvent, { type: 'message' }> & { conversationId: string }
): AgentConversationEntry => ({
  ...toMessageFromEvent(event),
  type: 'message',
});

type ConversationConnectionResolution = {
  connectionId: string | null;
  missingConversationConnection: boolean;
  usedFallback: boolean;
  connections: Connection[];
  settings: Settings;
  conversation: AgentConversation | null;
};

type UseAgentChatOptions = {
  messages: AgentMessage[];
  selectedConversationId: string | null;
  createConversation: (title?: string) => Promise<string | null>;
  appendMessage: (
    content: string,
    role: AgentMessage['role'],
    conversationId?: string,
    attachments?: AgentContextAttachment[]
  ) => Promise<void>;
  resolveConversationConnection: (
    conversationId: string
  ) => Promise<ConversationConnectionResolution>;
  touchConversation: (conversationId: string, updatedAt: string) => void;
  onError: (message: string | null) => void;
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>;
  setEntries: Dispatch<SetStateAction<AgentConversationEntry[]>>;
};

type UseAgentChatResult = {
  activeChatRunId: string | null;
  sendMessage: (content: string, attachments?: AgentContextAttachment[]) => Promise<void>;
  handleChatEvent: (event: AgentEvent) => void;
};

export function useAgentChat({
  messages,
  selectedConversationId,
  createConversation,
  appendMessage,
  resolveConversationConnection,
  touchConversation,
  onError,
  setMessages,
  setEntries,
}: UseAgentChatOptions): UseAgentChatResult {
  const { requestSecretAccess } = useConnectionsContext();
  const [activeChatRunId, setActiveChatRunId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, attachments?: AgentContextAttachment[]) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      const conversationId =
        selectedConversationId ?? (await createConversation()) ?? null;
      if (!conversationId) {
        return;
      }

      const historySnapshot = buildHistorySnapshot(messages);

      try {
        onError(null);
        await appendMessage(trimmed, 'user', conversationId, attachments);
        const {
          connectionId,
          connections,
          settings,
          conversation,
          missingConversationConnection,
        } =
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

        const shouldReloadConversation = missingConversationConnection;

        const access = await requestSecretAccess({
          connectionId,
          requesterId: 'agent-host',
          reason: 'agent.chat',
        });
        if (!access.granted) {
          onError('Secret access denied for this connection.');
          return;
        }

        const response = await window.api.agents.startRun({
          goal: trimmed,
          inputs: {
            conversationId,
            attachments,
            history: historySnapshot,
          },
          metadata: {
            workflow: 'chat',
            conversationId,
          },
        });
        setActiveChatRunId(response.run.id);

        if (shouldReloadConversation && conversationId === selectedConversationId) {
          const result = await window.api.agents.getConversation({ conversationId });
          const data = unwrapResult(result);
          setMessages(data.messages);
          const nextEntries = data.entries?.length
            ? data.entries
            : data.messages.map(toMessageEntry);
          setEntries(nextEntries);
          touchConversation(conversationId, data.conversation.updatedAt);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to send message.';
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

  const handleChatEvent = useCallback(
    (event: AgentEvent) => {
      if (
        event.type === 'status' &&
        event.runId === activeChatRunId &&
        FINAL_RUN_STATUSES.has(event.status)
      ) {
        setActiveChatRunId(null);
      }

      if (event.type === 'error' && event.runId === activeChatRunId) {
        onError(event.message);
      }

      if (event.type === 'message' && event.conversationId) {
        const messageEvent = event as Extract<AgentEvent, { type: 'message' }> & {
          conversationId: string;
        };
        const updatedAt = messageEvent.createdAt ?? messageEvent.timestamp;
        touchConversation(messageEvent.conversationId, updatedAt);
        if (messageEvent.conversationId === selectedConversationId) {
          const message = toMessageFromEvent(messageEvent);
          setMessages((prev) => [...prev, message]);
          setEntries((prev) => [...prev, toMessageEntryFromEvent(messageEvent)]);
        }
      }
    },
    [
      activeChatRunId,
      onError,
      selectedConversationId,
      setEntries,
      setMessages,
      touchConversation,
    ]
  );

  return {
    activeChatRunId,
    sendMessage,
    handleChatEvent,
  };
}
