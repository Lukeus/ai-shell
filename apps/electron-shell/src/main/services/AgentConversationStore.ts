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
  type Proposal,
} from 'packages-api-contracts';
import {
  buildEntriesFromMessagesMap,
  buildMessagesFromEntries,
  buildMessagesFromEntriesMap,
} from './agent-conversation-entries';
import {
  hydrateProposalEntry,
  normalizeConversationEntries,
  resolveProposalContent,
  stripProposalContent,
  toStoredAgentEditProposal,
} from './agent-edit-proposals';

type AgentConversationStoreData = {
  version: 3;
  conversations: Record<string, AgentConversation>;
  messages: Record<string, AgentMessage[]>;
  entries: Record<string, AgentConversationEntry[]>;
};

const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_ENTRIES_PER_CONVERSATION = 250;

const EMPTY_STORE: AgentConversationStoreData = {
  version: 3,
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
  private readonly proposalCache = new Map<string, Proposal>();

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
      entries: this.hydrateEntries(store.entries[conversationId] ?? []),
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

  public deleteConversation(conversationId: string): boolean {
    const store = this.loadStore();
    if (!store.conversations[conversationId]) {
      return false;
    }
    this.clearProposalCache(store.entries[conversationId] ?? []);
    delete store.conversations[conversationId];
    delete store.messages[conversationId];
    delete store.entries[conversationId];
    this.saveStore(store);
    return true;
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
      format: request.format,
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
    const entryId = randomUUID();
    if (proposal.proposal) {
      this.proposalCache.set(entryId, proposal.proposal);
    }
    const entry = AgentConversationProposalEntrySchema.parse({
      id: entryId,
      conversationId,
      type: 'proposal',
      proposal: {
        ...toStoredAgentEditProposal(proposal),
        proposal: proposal.proposal,
      },
      createdAt: now,
    });

    this.appendEntry(store, conversation, entry);
    this.saveStore(store);
    return hydrateProposalEntry(entry, this.proposalCache);
  }

  public getProposalEntry(
    conversationId: string,
    entryId: string
  ): AgentConversationProposalEntry {
    const { entries } = this.getConversation(conversationId);
    const entry = entries.find(
      (candidate): candidate is AgentConversationProposalEntry =>
        candidate.type === 'proposal' && candidate.id === entryId
    );
    if (!entry) {
      throw new Error(`Proposal entry not found: ${entryId}`);
    }
    return entry;
  }

  public resolveProposalContent(conversationId: string, entryId: string) {
    const entry = this.getProposalEntry(conversationId, entryId);
    return resolveProposalContent(entry, this.proposalCache);
  }

  public markProposalApplied(
    conversationId: string,
    entryId: string
  ): AgentConversationProposalEntry {
    return this.updateProposalState(conversationId, entryId, {
      state: 'applied',
      appliedAt: new Date().toISOString(),
      discardedAt: null,
      failedAt: null,
      failureMessage: undefined,
    });
  }

  public markProposalDiscarded(
    conversationId: string,
    entryId: string
  ): AgentConversationProposalEntry {
    return this.updateProposalState(conversationId, entryId, {
      state: 'discarded',
      appliedAt: null,
      discardedAt: new Date().toISOString(),
      failedAt: null,
      failureMessage: undefined,
    });
  }

  public markProposalFailed(
    conversationId: string,
    entryId: string,
    message: string
  ): AgentConversationProposalEntry {
    return this.updateProposalState(conversationId, entryId, {
      state: 'failed',
      failedAt: new Date().toISOString(),
      failureMessage: message,
    });
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
      this.clearProposalCache(store.entries[conversation.id] ?? []);
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
      const entries = normalizeConversationEntries(
        parsed.entries ?? buildEntriesFromMessagesMap(messages),
        conversations,
        MAX_ENTRIES_PER_CONVERSATION
      );
      return {
        version: 3,
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
      const removed = entries.splice(0, entries.length - MAX_ENTRIES_PER_CONVERSATION);
      this.clearProposalCache(removed);
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

  private hydrateEntries(entries: AgentConversationEntry[]): AgentConversationEntry[] {
    return entries.map((entry) =>
      entry.type === 'proposal' ? hydrateProposalEntry(entry, this.proposalCache) : entry
    );
  }

  private updateProposalState(
    conversationId: string,
    entryId: string,
    updates: Partial<AgentConversationProposalEntry>
  ): AgentConversationProposalEntry {
    const store = this.loadStore();
    const conversation = store.conversations[conversationId];
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const entries = store.entries[conversationId] ?? [];
    const index = entries.findIndex(
      (entry) => entry.type === 'proposal' && entry.id === entryId
    );
    if (index < 0) {
      throw new Error(`Proposal entry not found: ${entryId}`);
    }

    const current = this.hydrateEntries([entries[index]])[0];
    if (current.type !== 'proposal') {
      throw new Error(`Conversation entry is not a proposal: ${entryId}`);
    }

    const updated = AgentConversationProposalEntrySchema.parse({
      ...current,
      ...updates,
    });
    entries[index] = updated;
    store.entries[conversationId] = entries;
    store.messages[conversationId] = buildMessagesFromEntries(
      entries,
      MAX_MESSAGES_PER_CONVERSATION
    );
    store.conversations[conversationId] = AgentConversationSchema.parse({
      ...conversation,
      updatedAt:
        updated.appliedAt ??
        updated.discardedAt ??
        updated.failedAt ??
        updated.createdAt,
    });
    this.saveStore(store);
    return hydrateProposalEntry(updated, this.proposalCache);
  }

  private clearProposalCache(entries: AgentConversationEntry[]): void {
    for (const entry of entries) {
      if (entry.type === 'proposal') {
        this.proposalCache.delete(entry.id);
      }
    }
  }

  private saveStore(store: AgentConversationStoreData): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${this.storePath}.tmp`;
    const persistedStore: AgentConversationStoreData = {
      ...store,
      version: 3,
      entries: Object.fromEntries(
        Object.entries(store.entries).map(([conversationId, entries]) => [
          conversationId,
          entries.map((entry) => stripProposalContent(entry)),
        ])
      ),
    };
    fs.writeFileSync(tempPath, JSON.stringify(persistedStore, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.storePath);
  }
}

export const agentConversationStore = AgentConversationStore.getInstance();
