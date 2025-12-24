import { describe, it, expect } from 'vitest';
import { ProposalSchema, SddRunEventSchema } from './sdd';

describe('SDD workflow contracts', () => {
  it('accepts proposals with writes, patch, and summary', () => {
    const proposal = {
      writes: [
        {
          path: 'specs/151-sdd-workflow/spec.md',
          content: '# Spec\n',
        },
      ],
      patch: 'diff --git a/file b/file',
      summary: {
        filesChanged: 1,
        additions: 10,
        deletions: 2,
      },
    };

    expect(ProposalSchema.parse(proposal)).toEqual(proposal);
  });

  it('accepts workflow events with required fields', () => {
    const base = {
      id: '11111111-1111-1111-1111-111111111111',
      runId: '22222222-2222-2222-2222-222222222222',
      timestamp: new Date().toISOString(),
    };

    const started = {
      ...base,
      type: 'started',
      featureId: '151-sdd-workflow',
      goal: 'Ship SDD workflow',
      step: 'spec',
    };
    expect(SddRunEventSchema.parse(started)).toEqual(started);

    const proposalReady = {
      ...base,
      type: 'proposalReady',
      proposal: {
        writes: [],
        summary: { filesChanged: 0 },
      },
    };
    expect(SddRunEventSchema.parse(proposalReady)).toEqual({
      ...proposalReady,
      proposal: {
        ...proposalReady.proposal,
        writes: [],
      },
    });

    const testsCompleted = {
      ...base,
      type: 'testsCompleted',
      command: 'pnpm test',
      exitCode: 0,
      durationMs: 1200,
    };
    expect(SddRunEventSchema.parse(testsCompleted)).toEqual(testsCompleted);
  });

  it('rejects invalid workflow events', () => {
    const badEvent = {
      id: '33333333-3333-3333-3333-333333333333',
      runId: '44444444-4444-4444-4444-444444444444',
      timestamp: new Date().toISOString(),
      type: 'proposalReady',
    };

    expect(() => SddRunEventSchema.parse(badEvent)).toThrow();
  });
});
