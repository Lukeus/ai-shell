import type {
  AgentEvent,
  AgentMessageFormat,
  AgentRunStartRequest,
  AgentRunStatus,
} from 'packages-api-contracts';
import { agentConversationStore } from '../services/AgentConversationStore';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINAL_RUN_STATUSES: AgentRunStatus[] = ['completed', 'failed', 'canceled'];
const MAX_STATUS_LENGTH = 60;
const SUSPICIOUS_TOKEN_PATTERN = /[A-Za-z0-9_-]{20,}/g;

type StreamBuffer = {
  runId: string;
  conversationId?: string;
  messageId: string;
  format: AgentMessageFormat;
  content: string;
  lastSequence: number;
};

const streamBuffers = new Map<string, StreamBuffer>();

const parseConversationId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return UUID_PATTERN.test(value) ? value : undefined;
};

const buildStreamKey = (runId: string, messageId: string): string =>
  `${runId}:${messageId}`;

const normalizeContent = (content: string): string => {
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : content;
};

const sanitizeStatusText = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const collapsed = trimmed.replace(/\s+/g, ' ');
  const redacted = collapsed.replace(SUSPICIOUS_TOKEN_PATTERN, '[redacted]');
  const stripped = redacted.replace(/[^A-Za-z0-9 .,:/_-]/g, '');
  const limited = stripped.slice(0, MAX_STATUS_LENGTH);
  return limited.length > 0 ? limited : fallback;
};

const sanitizeStatusUpdateEvent = (
  event: Extract<AgentEvent, { type: 'status-update' }>
): AgentEvent => {
  const phase = sanitizeStatusText(event.phase, 'working').toLowerCase();
  const label = sanitizeStatusText(event.label, 'Working');
  return { ...event, phase, label };
};

const pruneStreamBuffersForRun = (runId: string): void => {
  for (const key of streamBuffers.keys()) {
    if (key.startsWith(`${runId}:`)) {
      streamBuffers.delete(key);
    }
  }
};

const updateStreamBuffer = (
  event: Extract<AgentEvent, { type: 'message-delta' }>
): void => {
  if (!event.messageId) {
    return;
  }
  const key = buildStreamKey(event.runId, event.messageId);
  const existing = streamBuffers.get(key);
  const lastSequence = existing?.lastSequence ?? -1;
  if (event.sequence <= lastSequence) {
    return;
  }
  const nextContent = `${existing?.content ?? ''}${event.contentDelta}`;
  streamBuffers.set(key, {
    runId: event.runId,
    conversationId: event.conversationId,
    messageId: event.messageId,
    format: event.format,
    content: nextContent,
    lastSequence: event.sequence,
  });
};

const finalizeStreamBuffer = (
  event: Extract<AgentEvent, { type: 'message-complete' }>
): { content: string; conversationId?: string } => {
  const normalized = normalizeContent(event.content);
  if (!event.messageId) {
    return { content: normalized, conversationId: event.conversationId };
  }
  const key = buildStreamKey(event.runId, event.messageId);
  const buffer = streamBuffers.get(key);
  streamBuffers.delete(key);
  if (normalized.trim().length > 0) {
    return { content: normalized, conversationId: event.conversationId ?? buffer?.conversationId };
  }
  return {
    content: buffer?.content ?? normalized,
    conversationId: event.conversationId ?? buffer?.conversationId,
  };
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
  if (event.type === 'status') {
    if (FINAL_RUN_STATUSES.includes(event.status)) {
      pruneStreamBuffersForRun(event.runId);
    }
    return event;
  }
  if (event.type === 'status-update') {
    return sanitizeStatusUpdateEvent(event);
  }
  if (event.type === 'message-delta') {
    updateStreamBuffer(event);
    return event;
  }
  if (event.type === 'message-complete') {
    const finalMessage = finalizeStreamBuffer(event);
    const conversationId = finalMessage.conversationId;
    if (!conversationId) {
      return event;
    }
    const content = finalMessage.content;
    if (!content.trim()) {
      return event;
    }
    try {
      const message = agentConversationStore.appendMessage({
        conversationId,
        role: 'agent',
        format: event.format,
        content,
      });
      return event.messageId ? event : { ...event, messageId: message.id };
    } catch {
      return event;
    }
  }
  if (event.type !== 'message' || !event.conversationId) {
    return event;
  }
  try {
    const message = agentConversationStore.appendMessage({
      conversationId: event.conversationId,
      role: event.role,
      format: event.format,
      content: event.content,
    });
    return event.messageId
      ? { ...event, createdAt: event.createdAt ?? message.createdAt }
      : { ...event, messageId: message.id, createdAt: message.createdAt };
  } catch {
    return event;
  }
};
