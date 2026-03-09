import type { Proposal } from 'packages-api-contracts';
import type { SddDocPaths } from './sdd-paths';
import {
  buildPatchProposal,
  buildWritesProposal,
  parseProposalCandidate,
  tryParseCodegenJsonRecord,
} from '../codegen/proposal-parser';

export const resolveTargetPath = (
  step: 'spec' | 'plan' | 'tasks',
  docPaths: SddDocPaths
): string => {
  if (step === 'spec') {
    return docPaths.specPath;
  }
  if (step === 'plan') {
    return docPaths.planPath;
  }
  return docPaths.tasksPath;
};

export const buildDocProposal = (path: string, content: string): Proposal => ({
  ...buildWritesProposal([{ path, content }]),
});

export const parseImplementationOutput = (output: string): Proposal => {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    throw new Error('SDD implement step returned empty output.');
  }

  const jsonRecord = tryParseCodegenJsonRecord(trimmed);
  if (jsonRecord) {
    return parseProposalCandidate(jsonRecord, 'SDD implement output');
  }

  return buildPatchProposal(trimmed);
};
