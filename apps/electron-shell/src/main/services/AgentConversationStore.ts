import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  AgentConversationSchema,
  AgentConversationMessageEntrySchema,
  AgentConversationProposalEntrySchema,
  AgentMessageSchema,
  type AgentConversation,
  type AgentConversationEntry,
  type AgentConversationProposalEntry,
  type AgentEditProposal,
  type AgentMessage,
  type AppendAgentMessageRequest,
} from 'packages-api-contracts';
import {
  buildEntriesFromMessagesMap,
  buildMessagesFromEntries,
  buildMessagesFromEntriesMap,
  normalizeEntries,
} from './agent-conversation-entries';

type AgentConversationStoreData = {
  version: 2;
  conversations: Record<string, AgentConversation>;
  messages: Record<string, AgentMessage[]>;
  entries: Record<string, AgentConversationEntry[]>;
};

const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_ENTRIES_PER_CONVERSATION = 250;

const EMPTY_STORE: AgentConversationStoreData = {
  version: 2,
  conversations: {},
  messages: {},
  entries: {},
};

/**
 * AgentConversationStore - persists agent conversations and message history.
 *
 * Notes:
 * - Conversations and messages are validated on write.
 * - Retention is bounded to avoid unbounded growth.
 */
export class AgentConversationStore {
  private static instance: AgentConversationStore | null = null;
  private readonly storePath: string;

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'agent-conversations.json');
  }

  public static getInstance(): AgentConversationStore {
    if (!AgentConversationStore.instance) {
      AgentConversationStore.instance = new AgentConversationStore();
    }
    return AgentConversationStore.instance;
  }

  public listConversations(): AgentConversation[] {
    const store = this.loadStore();
    return Object.values(store.conversations).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  public getConversation(
    conversationId: string
  ): { conversation: AgentConversation; messages: AgentMessage[]; entries: AgentConversationEntry[] } {
    const store = this.loadStore();
    const conversation = store.conversations[conversationId];
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return {
      conversation,
      messages: store.messages[conversationId] ?? [],
      entries: store.entries[conversationId] ?? [],
    };
  }

  public createConversation(title?: string): AgentConversation {
    const now = new Date().toISOString();
    const resolvedTitle =
      title && title.trim().length > 0 ? title.trim() : 'New Conversation';
    const conversation = AgentConversationSchema.parse({
      id: randomUUID(),
      title: resolvedTitle,
      createdAt: now,
      updatedAt: now,
    });

    const store = this.loadStore();
    store.conversations[conversation.id] = conversation;
    store.messages[conversation.id] = [];
    store.entries[conversation.id] = [];
    this.enforceConversationLimit(store);
    this.saveStore(store);
    return conversation;
  }

  public appendMessage(request: AppendAgentMessageRequest): AgentMessage {
    const store = this.loadStore();
    const conversation = store.conversations[request.conversationId];
    if (!conversation) {
      throw new Error(`Conversation not found: ${request.conversationId}`);
    }

    const now = new Date().toISOString();
    const attachments = this.sanitizeAttachments(request.attachments);
    const message = AgentMessageSchema.parse({
      id: randomUUID(),
      conversationId: request.conversationId,
      role: request.role,
      content: request.content,
      attachments,
      createdAt: now,
    });

    const entry = AgentConversationMessageEntrySchema.parse({
      ...message,
      type: 'message',
    });
    this.appendEntry(store, conversation, entry);

    this.saveStore(store);
    return message;
  }

  public appendProposal(
    conversationId: string,
    proposal: AgentEditProposal
  ): AgentConversationProposalEntry {
    const store = this.loadStore();
    const conversation = store.conversations[conversationId];
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const now = new Date().toISOString();
    const entry = AgentConversationProposalEntrySchema.parse({
      id: randomUUID(),
      conversationId,
      type: 'proposal',
      proposal,
      createdAt: now,
    });

    this.appendEntry(store, conversation, entry);
    this.saveStore(store);
    return entry;
  }

  private enforceConversationLimit(store: AgentConversationStoreData): void {
    const conversations = Object.values(store.conversations);
    if (conversations.length <= MAX_CONVERSATIONS) {
      return;
    }

    const excess = conversations.length - MAX_CONVERSATIONS;
    const sorted = conversations.sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt)
    );
    const toRemove = sorted.slice(0, excess);
    for (const conversation of toRemove) {
      delete store.conversations[conversation.id];
      delete store.messages[conversation.id];
      delete store.entries[conversation.id];
    }
  }

  private loadStore(): AgentConversationStoreData {
    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<AgentConversationStoreData>;
      if (!parsed || typeof parsed !== 'object') {
        return { ...EMPTY_STORE };
      }
      const conversations = parsed.conversations ?? {};
      const messages = parsed.messages ?? {};
      const entries = normalizeEntries(
        parsed.entries ?? buildEntriesFromMessagesMap(messages),
        conversations,
        MAX_ENTRIES_PER_CONVERSATION
      );
      return {
        version: 2,
        conversations,
        messages: buildMessagesFromEntriesMap(entries, MAX_MESSAGES_PER_CONVERSATION),
        entries,
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  private appendEntry(
    store: AgentConversationStoreData,
    conversation: AgentConversation,
    entry: AgentConversationEntry
  ): void {
    const entries = store.entries[entry.conversationId] ?? [];
    entries.push(entry);
    if (entries.length > MAX_ENTRIES_PER_CONVERSATION) {
      entries.splice(0, entries.length - MAX_ENTRIES_PER_CONVERSATION);
    }
    store.entries[entry.conversationId] = entries;

    const messages = buildMessagesFromEntries(entries, MAX_MESSAGES_PER_CONVERSATION);
    store.messages[entry.conversationId] = messages;

    store.conversations[entry.conversationId] = AgentConversationSchema.parse({
      ...conversation,
      updatedAt: entry.createdAt,
    });
  }

  private sanitizeAttachments(
    attachments: AppendAgentMessageRequest['attachments']
  ): AgentMessage['attachments'] {
    if (!attachments || attachments.length === 0) {
      return undefined;
    }
    return attachments.map((attachment) => ({
      ...attachment,
      snippet: undefined,
    }));
  }

  private saveStore(store: AgentConversationStoreData): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }
}

export const agentConversationStore = AgentConversationStore.getInstance();
