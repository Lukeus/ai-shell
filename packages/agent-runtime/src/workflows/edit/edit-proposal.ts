import {
  AgentEditProposalSchema,
  type AgentEditProposal,
  type AgentEditRequestOptions,
  type Proposal,
} from 'packages-api-contracts';
import {
  buildPatchProposal,
  normalizeCodegenModelOutput,
  parseProposalCandidate,
  tryParseCodegenJsonRecord,
} from '../codegen/proposal-parser';

export const parseEditProposalOutput = (
  text: string,
  options?: AgentEditRequestOptions
): AgentEditProposal => {
  const normalized = normalizeCodegenModelOutput(text);
  const jsonProposal = tryParseJsonOutput(normalized, options);
  if (jsonProposal) {
    return jsonProposal;
  }

  const patch = normalized.trim();
  if (!patch) {
    throw new Error('Edit output was empty.');
  }

  assertPatchSize(patch, options?.maxPatchBytes);
  const proposal = buildPatchProposal(patch);
  assertProposalConstraints(proposal, options);
  return toAgentEditProposal(proposal, buildSummaryText(proposal));
};

const tryParseJsonOutput = (
  output: string,
  options?: AgentEditRequestOptions
): AgentEditProposal | null => {
  const record = tryParseCodegenJsonRecord(output);
  if (!record) {
    return null;
  }
  const proposalCandidate = record.proposal ?? record;
  const proposal = parseProposalCandidate(proposalCandidate, 'Edit proposal');
  assertProposalConstraints(proposal, options);

  const summaryText =
    typeof record.summary === 'string' && record.summary.trim().length > 0
      ? record.summary.trim()
      : buildSummaryText(proposal);

  return toAgentEditProposal(proposal, summaryText);
};

const assertProposalConstraints = (
  proposal: Proposal,
  options?: AgentEditRequestOptions
): void => {
  if (options?.allowWrites === false && proposal.mode === 'writes') {
    throw new Error('Edit proposal included writes but allowWrites is false.');
  }
  if (proposal.mode === 'patch') {
    assertPatchSize(proposal.patch, options?.maxPatchBytes);
  }
};

const assertPatchSize = (patch: string, maxPatchBytes?: number): void => {
  if (!maxPatchBytes || maxPatchBytes <= 0) {
    return;
  }
  const bytes = Buffer.byteLength(patch, 'utf8');
  if (bytes > maxPatchBytes) {
    throw new Error(`Patch exceeds maxPatchBytes (${bytes} > ${maxPatchBytes}).`);
  }
};

const toAgentEditProposal = (
  proposal: Proposal,
  summary: string
): AgentEditProposal => {
  return AgentEditProposalSchema.parse({
    summary,
    mode: proposal.mode,
    changeSummary: proposal.summary,
    proposal,
  });
};

const buildSummaryText = (proposal: Proposal): string => {
  const fileCount = proposal.summary.filesChanged;
  const label = fileCount === 1 ? 'file' : 'files';
  return `Edit proposal (${fileCount} ${label}).`;
};
