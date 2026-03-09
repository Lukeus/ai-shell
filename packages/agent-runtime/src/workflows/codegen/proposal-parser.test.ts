import { describe, expect, it } from 'vitest';
import {
  buildPatchProposal,
  parseProposalCandidate,
  tryParseCodegenJsonRecord,
} from './proposal-parser';

describe('proposal-parser', () => {
  it('parses writes proposals from JSON records', () => {
    const record = tryParseCodegenJsonRecord(
      JSON.stringify({
        mode: 'writes',
        writes: [{ path: 'src/file.ts', content: 'export const value = 1;\n' }],
        summary: { filesChanged: 1 },
      })
    );

    expect(record).toBeTruthy();
    expect(parseProposalCandidate(record, 'Test proposal')).toEqual({
      mode: 'writes',
      writes: [{ path: 'src/file.ts', content: 'export const value = 1;\n' }],
      summary: { filesChanged: 1 },
    });
  });

  it('rejects mixed-mode proposal candidates', () => {
    expect(() =>
      parseProposalCandidate(
        {
          writes: [{ path: 'src/file.ts', content: 'export const value = 1;\n' }],
          patch: 'diff --git a/src/file.ts b/src/file.ts',
          summary: { filesChanged: 1 },
        },
        'Test proposal'
      )
    ).toThrow(/either writes or patch/i);
  });

  it('builds patch proposals with a computed file count', () => {
    const proposal = buildPatchProposal(
      [
        'diff --git a/src/file.ts b/src/file.ts',
        '--- a/src/file.ts',
        '+++ b/src/file.ts',
        '@@ -1 +1 @@',
        '-const value = 1;',
        '+const value = 2;',
      ].join('\n')
    );

    expect(proposal.mode).toBe('patch');
    expect(proposal.summary.filesChanged).toBe(1);
  });
});
