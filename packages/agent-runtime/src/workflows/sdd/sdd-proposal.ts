import type { Proposal } from 'packages-api-contracts';
import { ProposalSchema } from 'packages-api-contracts';
import type { SddDocPaths } from './sdd-paths';

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
  writes: [{ path, content }],
  summary: { filesChanged: 1 },
});

export const normalizeModelOutput = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  const normalized = match ? match[1].trimEnd() : trimmed;
  if (normalized.length === 0) {
    throw new Error('model.generate returned empty output');
  }
  return normalized;
};

export const parseImplementationOutput = (output: string): Proposal => {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    throw new Error('SDD implement step returned empty output.');
  }

  const jsonProposal = tryParseProposalJson(trimmed);
  if (jsonProposal) {
    return jsonProposal;
  }

  const patchFileCount = countFilesInPatch(trimmed);
  const proposal = {
    writes: [],
    patch: trimmed,
    summary: {
      filesChanged: Math.max(1, patchFileCount),
    },
  };

  return ProposalSchema.parse(proposal);
};

const tryParseProposalJson = (output: string): Proposal | null => {
  const startsLikeJson = output.startsWith('{') || output.startsWith('[');
  if (!startsLikeJson) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
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
      typeof summaryInput?.additions === 'number'
        ? summaryInput.additions
        : undefined,
    deletions:
      typeof summaryInput?.deletions === 'number'
        ? summaryInput.deletions
        : undefined,
  };

  if (writes.length === 0 && !patch) {
    throw new Error('SDD implement output did not include any writes or patch.');
  }

  return ProposalSchema.parse({
    writes,
    patch,
    summary,
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
