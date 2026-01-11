import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import type { AgentEditProposal } from 'packages-api-contracts';

const mockPaths = vi.hoisted(() => ({
  userDataPath: 'C:\\mock\\userdata',
  storePath: 'C:\\mock\\userdata\\agent-conversations.json',
}));

let savedContent = '';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockPaths.userDataPath),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn((file: string, data: string) => {
    if (file === mockPaths.storePath) {
      savedContent = data;
    }
  }),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { AgentConversationStore } from '../AgentConversationStore';

describe('AgentConversationStore entries', () => {
  let store: AgentConversationStore;

  beforeEach(() => {
    vi.clearAllMocks();
    savedContent = '';
    // @ts-expect-error Reset singleton for tests
    AgentConversationStore.instance = null;
    store = AgentConversationStore.getInstance();
  });

  it('persists message entries and strips attachment snippets', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const conversation = store.createConversation('Entry Test');
    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    store.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Hello',
      attachments: [
        {
          kind: 'file',
          filePath: 'C:\\repo\\file.ts',
          snippet: 'secret code',
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 5,
          },
        },
      ],
    });

    const payload = JSON.parse(savedContent) as {
      entries: Record<string, Array<Record<string, unknown>>>;
      messages: Record<string, Array<Record<string, unknown>>>;
    };

    const entry = payload.entries[conversation.id][0] as {
      type: string;
      attachments?: Array<Record<string, unknown>>;
    };
    expect(entry.type).toBe('message');
    expect(entry.attachments).toHaveLength(1);
    expect(entry.attachments?.[0].snippet).toBeUndefined();
    expect(entry.attachments?.[0].range).toBeTruthy();

    const message = payload.messages[conversation.id][0] as {
      attachments?: Array<Record<string, unknown>>;
    };
    expect(message.attachments?.[0].snippet).toBeUndefined();
  });

  it('derives entries when only messages are stored', () => {
    const conversationId = '123e4567-e89b-12d3-a456-426614174111';
    const stored = {
      version: 2,
      conversations: {
        [conversationId]: {
          id: conversationId,
          title: 'Legacy',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
      messages: {
        [conversationId]: [
          {
            id: '123e4567-e89b-12d3-a456-426614174222',
            conversationId,
            role: 'user',
            content: 'Legacy message',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    };

    vi.mocked(fs.readFileSync).mockImplementation(() => JSON.stringify(stored));

    const conversation = store.getConversation(conversationId);
    expect(conversation.entries).toHaveLength(1);
    expect(conversation.entries[0].type).toBe('message');
    expect(conversation.entries[0].content).toBe('Legacy message');
  });

  it('stores proposal entries without adding messages', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const conversation = store.createConversation('Proposal Test');
    vi.mocked(fs.readFileSync).mockImplementation(() => savedContent);

    const proposal: AgentEditProposal = {
      summary: 'Update file',
      proposal: {
        writes: [{ path: 'src/index.ts', content: 'console.log(1);' }],
        summary: { filesChanged: 1 },
      },
    };

    store.appendProposal(conversation.id, proposal);

    const payload = JSON.parse(savedContent) as {
      entries: Record<string, Array<Record<string, unknown>>>;
      messages: Record<string, Array<Record<string, unknown>>>;
    };

    const entry = payload.entries[conversation.id][0] as { type: string };
    expect(entry.type).toBe('proposal');
    expect(payload.messages[conversation.id]).toHaveLength(0);
  });
});
