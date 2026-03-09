import {
  ProposalSchema,
  type Proposal,
  type ProposalFileWrite,
} from 'packages-api-contracts';

const countFilesInPatch = (patch: string): number => {
  const diffMatches = patch.match(/^diff --git /gm);
  if (diffMatches && diffMatches.length > 0) {
    return diffMatches.length;
  }
  const fileMatches = patch.match(/^\+\+\+ /gm);
  return fileMatches ? fileMatches.length : 0;
};

const normalizeWrites = (candidate: unknown): ProposalFileWrite[] => {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      if (typeof record.path !== 'string' || record.path.length === 0) {
        return null;
      }
      if (typeof record.content !== 'string') {
        return null;
      }
      return {
        path: record.path,
        content: record.content,
      };
    })
    .filter((entry): entry is ProposalFileWrite => Boolean(entry));
};

export const normalizeCodegenModelOutput = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  const normalized = match ? match[1].trimEnd() : trimmed;
  if (normalized.length === 0) {
    throw new Error('model.generate returned empty output');
  }
  return normalized;
};

export const tryParseCodegenJsonRecord = (
  output: string
): Record<string, unknown> | null => {
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

  return parsed && typeof parsed === 'object'
    ? (parsed as Record<string, unknown>)
    : null;
};

export const buildPatchProposal = (patch: string): Proposal => {
  const filesChanged = Math.max(1, countFilesInPatch(patch));
  return ProposalSchema.parse({
    mode: 'patch',
    patch,
    summary: {
      filesChanged,
    },
  });
};

export const buildWritesProposal = (writes: ProposalFileWrite[]): Proposal =>
  ProposalSchema.parse({
    mode: 'writes',
    writes,
    summary: {
      filesChanged: writes.length,
    },
  });

export const parseProposalCandidate = (
  candidate: unknown,
  sourceLabel: string
): Proposal => {
  const parsed = ProposalSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`${sourceLabel} must include a proposal object.`);
  }

  const record = candidate as Record<string, unknown>;
  const writes = normalizeWrites(record.writes);
  const patch =
    typeof record.patch === 'string' && record.patch.trim().length > 0
      ? record.patch
      : undefined;
  const summaryInput =
    record.summary && typeof record.summary === 'object'
      ? (record.summary as Record<string, unknown>)
      : undefined;

  if (writes.length > 0 && patch) {
    throw new Error(`${sourceLabel} must use either writes or patch, not both.`);
  }

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

  if (patch) {
    return ProposalSchema.parse({
      mode: 'patch',
      patch,
      summary,
    });
  }

  if (writes.length > 0) {
    return ProposalSchema.parse({
      mode: 'writes',
      writes,
      summary,
    });
  }

  throw new Error(`${sourceLabel} did not include any writes or patch.`);
};
