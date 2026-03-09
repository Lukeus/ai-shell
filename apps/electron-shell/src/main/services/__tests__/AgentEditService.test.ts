import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proposal } from 'packages-api-contracts';

const {
  applyProposalMock,
  getWorkspaceMock,
  getProposalEntryMock,
  markProposalAppliedMock,
  markProposalDiscardedMock,
  markProposalFailedMock,
  resolveProposalContentMock,
  logAgentProposalApplyMock,
  logAgentProposalDiscardMock,
} = vi.hoisted(() => ({
  applyProposalMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  getProposalEntryMock: vi.fn(),
  markProposalAppliedMock: vi.fn(),
  markProposalDiscardedMock: vi.fn(),
  markProposalFailedMock: vi.fn(),
  resolveProposalContentMock: vi.fn(),
  logAgentProposalApplyMock: vi.fn(),
  logAgentProposalDiscardMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

vi.mock('../../index', () => ({
  getAgentHostManager: vi.fn(() => null),
}));

vi.mock('../WorkspaceService', () => ({
  workspaceService: {
    getWorkspace: getWorkspaceMock,
  },
}));

vi.mock('../PatchApplyService', () => ({
  patchApplyService: {
    applyProposal: applyProposalMock,
  },
}));

vi.mock('../AgentConversationStore', () => ({
  agentConversationStore: {
    getProposalEntry: getProposalEntryMock,
    markProposalApplied: markProposalAppliedMock,
    markProposalDiscarded: markProposalDiscardedMock,
    markProposalFailed: markProposalFailedMock,
    resolveProposalContent: resolveProposalContentMock,
  },
}));

vi.mock('../AuditService', () => ({
  auditService: {
    logAgentProposalApply: logAgentProposalApplyMock,
    logAgentProposalDiscard: logAgentProposalDiscardMock,
  },
}));

import { AgentEditService } from '../AgentEditService';
import { agentConversationStore } from '../AgentConversationStore';
import { workspaceService } from '../WorkspaceService';
import { patchApplyService } from '../PatchApplyService';

describe('AgentEditService applyProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProposalEntryMock).mockReturnValue({
      id: '123e4567-e89b-12d3-a456-426614174001',
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'proposal',
      state: 'pending',
      createdAt: '2024-01-01T00:00:00.000Z',
      appliedAt: null,
      discardedAt: null,
      failedAt: null,
      proposal: {
        summary: 'Update file',
        mode: 'writes',
        changeSummary: { filesChanged: 1 },
      },
    });
    vi.mocked(markProposalAppliedMock).mockReturnValue({
      id: '123e4567-e89b-12d3-a456-426614174001',
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'proposal',
      state: 'applied',
      createdAt: '2024-01-01T00:00:00.000Z',
      appliedAt: '2024-01-01T00:00:05.000Z',
      discardedAt: null,
      failedAt: null,
      proposal: {
        summary: 'Update file',
        mode: 'writes',
        changeSummary: { filesChanged: 1 },
      },
    });
  });

  it('throws when no workspace is open', async () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

    const service = new AgentEditService();
    const proposal: Proposal = {
      mode: 'writes',
      writes: [{ path: 'src/file.ts', content: 'test' }],
      summary: { filesChanged: 1 },
    };

    await expect(
      service.applyProposal({ proposal })
    ).rejects.toThrow(/No workspace open/i);
  });

  it('applies proposal using the workspace root', async () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: 'C:\\repo',
      name: 'repo',
    });
    vi.mocked(patchApplyService.applyProposal).mockResolvedValue({
      files: ['src/file.ts'],
      summary: { filesChanged: 1 },
    });

    const service = new AgentEditService();
    const proposal: Proposal = {
      mode: 'writes',
      writes: [{ path: 'src/file.ts', content: 'test' }],
      summary: { filesChanged: 1 },
    };

    const result = await service.applyProposal({ proposal });

    expect(patchApplyService.applyProposal).toHaveBeenCalledWith(
      proposal,
      'C:\\repo'
    );
    expect(result.files).toEqual(['src/file.ts']);
    expect(result.summary.filesChanged).toBe(1);
    expect(result.state).toBe('applied');
  });

  it('persists proposal state transitions when applying tracked proposals', async () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: 'C:\\repo',
      name: 'repo',
    });
    vi.mocked(patchApplyService.applyProposal).mockResolvedValue({
      files: ['src/file.ts'],
      summary: { filesChanged: 1 },
    });
    vi.mocked(resolveProposalContentMock).mockReturnValue({
      mode: 'writes',
      writes: [{ path: 'src/file.ts', content: 'test' }],
      summary: { filesChanged: 1 },
    });

    const service = new AgentEditService();
    const result = await service.applyProposal({
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      entryId: '123e4567-e89b-12d3-a456-426614174001',
    });

    expect(agentConversationStore.getProposalEntry).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001'
    );
    expect(agentConversationStore.markProposalApplied).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001'
    );
    expect(logAgentProposalApplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        entryId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'success',
        filesChanged: 1,
      })
    );
    expect(result.appliedAt).toBe('2024-01-01T00:00:05.000Z');
  });

  it('marks tracked proposals as discarded', () => {
    vi.mocked(markProposalDiscardedMock).mockReturnValue({
      id: '123e4567-e89b-12d3-a456-426614174001',
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'proposal',
      state: 'discarded',
      createdAt: '2024-01-01T00:00:00.000Z',
      appliedAt: null,
      discardedAt: '2024-01-01T00:00:06.000Z',
      failedAt: null,
      proposal: {
        summary: 'Update file',
        mode: 'writes',
        changeSummary: { filesChanged: 1 },
      },
    });

    const service = new AgentEditService();
    const result = service.discardProposal({
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      entryId: '123e4567-e89b-12d3-a456-426614174001',
    });

    expect(agentConversationStore.markProposalDiscarded).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001'
    );
    expect(logAgentProposalDiscardMock).toHaveBeenCalledWith({
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      entryId: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(result).toEqual({
      state: 'discarded',
      discardedAt: '2024-01-01T00:00:06.000Z',
    });
  });
});
