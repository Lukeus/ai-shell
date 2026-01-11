import type { AgentEvent, AgentRunStartRequest } from 'packages-api-contracts';
import { agentConversationStore } from '../services/AgentConversationStore';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseConversationId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return UUID_PATTERN.test(value) ? value : undefined;
};

export const resolveConversationId = (
  request: AgentRunStartRequest
): string | undefined => {
  const metadataValue = parseConversationId(request.metadata?.conversationId);
  if (metadataValue) {
    return metadataValue;
  }
  const inputsValue = parseConversationId(
    (request.inputs as Record<string, unknown> | undefined)?.conversationId
  );
  return inputsValue;
};

export const resolveConversationOverrides = (
  conversationId?: string
): { connectionId?: string; modelRef?: string } => {
  if (!conversationId) {
    return {};
  }
  try {
    const { conversation } = agentConversationStore.getConversation(conversationId);
    return {
      connectionId: conversation.connectionId,
      modelRef: conversation.modelRef,
    };
  } catch {
    return {};
  }
};

export const warnMissingConversationConnection = (
  conversationId: string,
  connectionId: string
): void => {
  try {
    agentConversationStore.appendMessage({
      conversationId,
      role: 'system',
      content: `Connection ${connectionId} not found. Using default connection.`,
    });
  } catch {
    // Ignore failures when writing warning messages.
  }
};

export const persistMessageEvent = (event: AgentEvent): AgentEvent => {
  if (event.type !== 'message' || !event.conversationId) {
    return event;
  }
  try {
    const message = agentConversationStore.appendMessage({
      conversationId: event.conversationId,
      role: event.role,
      content: event.content,
    });
    return { ...event, messageId: message.id, createdAt: message.createdAt };
  } catch {
    return event;
  }
};
