import { describe, it, expect } from 'vitest';
import { ProposalSchema, SddRunEventSchema } from './sdd';

describe('SDD workflow contracts', () => {
  it('accepts writes proposals with an explicit mode', () => {
    const proposal = {
      mode: 'writes',
      writes: [
        {
          path: 'specs/151-sdd-workflow/spec.md',
          content: '# Spec\n',
        },
      ],
      summary: {
        filesChanged: 1,
        additions: 10,
        deletions: 2,
      },
    };

    expect(ProposalSchema.parse(proposal)).toEqual(proposal);
  });

  it('rejects mixed proposal payloads without an explicit hybrid mode', () => {
    expect(() =>
      ProposalSchema.parse({
        mode: 'writes',
        writes: [
          {
            path: 'specs/151-sdd-workflow/spec.md',
            content: '# Spec\n',
          },
        ],
        patch: 'diff --git a/file b/file',
        summary: {
          filesChanged: 1,
        },
      })
    ).toThrow();
  });

  it('accepts workflow events with required fields', () => {
    const base = {
      id: '11111111-1111-4111-8111-111111111111',
      runId: '22222222-2222-4222-8222-222222222222',
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
        mode: 'writes',
        writes: [
          {
            path: 'specs/151-sdd-workflow/spec.md',
            content: '# Spec\n',
          },
        ],
        summary: { filesChanged: 0 },
      },
    };
    expect(SddRunEventSchema.parse(proposalReady)).toEqual(proposalReady);

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
      id: '33333333-3333-4333-8333-333333333333',
      runId: '44444444-4444-4444-8444-444444444444',
      timestamp: new Date().toISOString(),
      type: 'proposalReady',
    };

    expect(() => SddRunEventSchema.parse(badEvent)).toThrow();
  });
});
