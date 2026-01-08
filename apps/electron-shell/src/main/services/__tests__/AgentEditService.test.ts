import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proposal } from 'packages-api-contracts';

const applyProposalMock = vi.fn();
const getWorkspaceMock = vi.fn();

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

import { AgentEditService } from '../AgentEditService';
import { workspaceService } from '../WorkspaceService';
import { patchApplyService } from '../PatchApplyService';

describe('AgentEditService applyProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when no workspace is open', async () => {
    vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

    const service = new AgentEditService();
    const proposal: Proposal = {
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
  });
});
