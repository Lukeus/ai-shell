import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  AgentConversationSchema,
  AgentMessageSchema,
  type AgentConversation,
  type AgentMessage,
  type AppendAgentMessageRequest,
} from 'packages-api-contracts';

type AgentConversationStoreData = {
  version: 1;
  conversations: Record<string, AgentConversation>;
  messages: Record<string, AgentMessage[]>;
};

const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 200;

const EMPTY_STORE: AgentConversationStoreData = {
  version: 1,
  conversations: {},
  messages: {},
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
  ): { conversation: AgentConversation; messages: AgentMessage[] } {
    const store = this.loadStore();
    const conversation = store.conversations[conversationId];
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return {
      conversation,
      messages: store.messages[conversationId] ?? [],
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
    const message = AgentMessageSchema.parse({
      id: randomUUID(),
      conversationId: request.conversationId,
      role: request.role,
      content: request.content,
      createdAt: now,
    });

    const messages = store.messages[request.conversationId] ?? [];
    messages.push(message);
    if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
      messages.splice(0, messages.length - MAX_MESSAGES_PER_CONVERSATION);
    }
    store.messages[request.conversationId] = messages;

    store.conversations[request.conversationId] = AgentConversationSchema.parse({
      ...conversation,
      updatedAt: now,
    });

    this.saveStore(store);
    return message;
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
    }
  }

  private loadStore(): AgentConversationStoreData {
    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<AgentConversationStoreData>;
      if (!parsed || typeof parsed !== 'object') {
        return { ...EMPTY_STORE };
      }
      return {
        version: 1,
        conversations: parsed.conversations ?? {},
        messages: parsed.messages ?? {},
      };
    } catch {
      return { ...EMPTY_STORE };
    }
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
