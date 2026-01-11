import {
  AgentConversationMessageEntrySchema,
  AgentConversationEntrySchema,
  type AgentConversation,
  type AgentConversationEntry,
  type AgentConversationMessageEntry,
  type AgentMessage,
} from 'packages-api-contracts';

export const buildEntriesFromMessagesMap = (
  messagesByConversation: Record<string, AgentMessage[]>
): Record<string, AgentConversationEntry[]> => {
  const entries: Record<string, AgentConversationEntry[]> = {};
  for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
    const mapped: AgentConversationEntry[] = [];
    for (const message of messages) {
      const parsed = AgentConversationMessageEntrySchema.safeParse({
        ...message,
        type: 'message',
      });
      if (parsed.success) {
        mapped.push(parsed.data);
      }
    }
    entries[conversationId] = mapped;
  }
  return entries;
};

export const buildMessagesFromEntries = (
  entries: AgentConversationEntry[],
  maxMessages: number
): AgentMessage[] => {
  const messages = entries
    .filter(
      (entry): entry is AgentConversationMessageEntry => entry.type === 'message'
    )
    .map((entry) => {
      const { type, ...message } = entry;
      return message as AgentMessage;
    });
  if (messages.length > maxMessages) {
    return messages.slice(-maxMessages);
  }
  return messages;
};

export const buildMessagesFromEntriesMap = (
  entriesByConversation: Record<string, AgentConversationEntry[]>,
  maxMessages: number
): Record<string, AgentMessage[]> => {
  const messages: Record<string, AgentMessage[]> = {};
  for (const [conversationId, entries] of Object.entries(entriesByConversation)) {
    messages[conversationId] = buildMessagesFromEntries(entries, maxMessages);
  }
  return messages;
};

export const normalizeEntries = (
  entries: Record<string, AgentConversationEntry[]>,
  conversations: Record<string, AgentConversation>,
  maxEntries: number
): Record<string, AgentConversationEntry[]> => {
  const normalized: Record<string, AgentConversationEntry[]> = {};
  for (const [conversationId, entryList] of Object.entries(entries)) {
    const list = Array.isArray(entryList) ? entryList : [];
    const parsed = list
      .map((entry) => AgentConversationEntrySchema.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => result.data);
    normalized[conversationId] =
      parsed.length > maxEntries ? parsed.slice(-maxEntries) : parsed;
  }
  for (const conversationId of Object.keys(conversations)) {
    if (!normalized[conversationId]) {
      normalized[conversationId] = [];
    }
  }
  return normalized;
};
