import {
  AgentEditProposalSchema,
  ProposalSchema,
  type AgentEditProposal,
  type AgentEditRequestOptions,
  type Proposal,
} from 'packages-api-contracts';

export const parseEditProposalOutput = (
  text: string,
  options?: AgentEditRequestOptions
): AgentEditProposal => {
  const normalized = normalizeModelOutput(text);
  const jsonProposal = tryParseJsonOutput(normalized, options);
  if (jsonProposal) {
    return jsonProposal;
  }

  const patch = normalized.trim();
  if (!patch) {
    throw new Error('Edit output was empty.');
  }

  assertPatchSize(patch, options?.maxPatchBytes);
  const proposal = buildProposalFromPatch(patch);
  assertProposalConstraints(proposal, options);

  return AgentEditProposalSchema.parse({
    summary: buildSummaryText(proposal),
    proposal,
  });
};

const tryParseJsonOutput = (
  output: string,
  options?: AgentEditRequestOptions
): AgentEditProposal | null => {
  const trimmed = output.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const proposalCandidate = record.proposal ?? record;
  const proposal = parseProposalCandidate(proposalCandidate);
  assertProposalConstraints(proposal, options);

  const summaryText =
    typeof record.summary === 'string' && record.summary.trim().length > 0
      ? record.summary.trim()
      : buildSummaryText(proposal);

  return AgentEditProposalSchema.parse({
    summary: summaryText,
    proposal,
  });
};

const parseProposalCandidate = (candidate: unknown): Proposal => {
  const parsed = ProposalSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Edit output must include a proposal object.');
  }

  const record = candidate as Record<string, unknown>;
  const writes = Array.isArray(record.writes)
    ? record.writes
        .map((write) => {
          if (!write || typeof write !== 'object') {
            return null;
          }
          const entry = write as Record<string, unknown>;
          if (typeof entry.path !== 'string' || entry.path.length === 0) {
            return null;
          }
          if (typeof entry.content !== 'string') {
            return null;
          }
          return { path: entry.path, content: entry.content };
        })
        .filter((write): write is { path: string; content: string } => Boolean(write))
    : [];
  const patch =
    typeof record.patch === 'string' && record.patch.trim().length > 0
      ? record.patch
      : undefined;
  const summaryInput =
    record.summary && typeof record.summary === 'object'
      ? (record.summary as Record<string, unknown>)
      : undefined;
  const filesFromPatch = patch ? countFilesInPatch(patch) : 0;
  const filesChangedFallback = Math.max(writes.length, filesFromPatch, patch ? 1 : 0);
  const summary = {
    filesChanged:
      typeof summaryInput?.filesChanged === 'number'
        ? summaryInput.filesChanged
        : filesChangedFallback,
    additions:
      typeof summaryInput?.additions === 'number' ? summaryInput.additions : undefined,
    deletions:
      typeof summaryInput?.deletions === 'number' ? summaryInput.deletions : undefined,
  };

  if (writes.length === 0 && !patch) {
    throw new Error('Edit proposal did not include any writes or patch.');
  }

  return ProposalSchema.parse({
    writes,
    patch,
    summary,
  });
};

const assertProposalConstraints = (
  proposal: Proposal,
  options?: AgentEditRequestOptions
): void => {
  if (options?.allowWrites === false && proposal.writes.length > 0) {
    throw new Error('Edit proposal included writes but allowWrites is false.');
  }
  if (proposal.patch) {
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

const buildProposalFromPatch = (patch: string): Proposal => {
  const filesChanged = Math.max(1, countFilesInPatch(patch));
  return ProposalSchema.parse({
    writes: [],
    patch,
    summary: {
      filesChanged,
    },
  });
};

const countFilesInPatch = (patch: string): number => {
  const diffMatches = patch.match(/^diff --git /gm);
  if (diffMatches && diffMatches.length > 0) {
    return diffMatches.length;
  }
  const plusPlusMatches = patch.match(/^\+\+\+ /gm);
  return plusPlusMatches ? plusPlusMatches.length : 0;
};

const normalizeModelOutput = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  const normalized = match ? match[1].trimEnd() : trimmed;
  if (normalized.length === 0) {
    throw new Error('model.generate returned empty output');
  }
  return normalized;
};

const buildSummaryText = (proposal: Proposal): string => {
  const fileCount = proposal.summary.filesChanged;
  const label = fileCount === 1 ? 'file' : 'files';
  return `Edit proposal (${fileCount} ${label}).`;
};
