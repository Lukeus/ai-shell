import { describe, expect, it, vi, beforeEach } from 'vitest';

let appendFileSyncMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

vi.mock('fs', () => ({
  appendFileSync: (...args: unknown[]) => appendFileSyncMock(...args),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
}));

import { AuditService } from './AuditService';

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendFileSyncMock = vi.fn();
    // @ts-expect-error Reset singleton for tests
    AuditService.instance = null;
  });

  it('logs agent proposal apply events', () => {
    const service = AuditService.getInstance();

    service.logAgentProposalApply({
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      entryId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'success',
      filesChanged: 1,
      files: ['src/file.ts'],
    });

    expect(appendFileSyncMock).toHaveBeenCalledWith(
      'C:\\mock\\userdata\\audit.log.jsonl',
      expect.stringContaining('"type":"agent.proposal.apply"'),
      'utf-8'
    );
  });

  it('logs agent proposal discard events', () => {
    const service = AuditService.getInstance();

    service.logAgentProposalDiscard({
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      entryId: '123e4567-e89b-12d3-a456-426614174001',
    });

    expect(appendFileSyncMock).toHaveBeenCalledWith(
      'C:\\mock\\userdata\\audit.log.jsonl',
      expect.stringContaining('"type":"agent.proposal.discard"'),
      'utf-8'
    );
  });
});
