import {
  AgentConversationEntrySchema,
  AgentConversationProposalEntrySchema,
  AgentEditProposalSchema,
  type AgentConversation,
  type AgentConversationEntry,
  type AgentConversationProposalEntry,
  type AgentEditProposal,
  type Proposal,
  type ProposalFileWrite,
  ProposalSchema,
} from 'packages-api-contracts';

type ProposalCache = ReadonlyMap<string, Proposal>;

const countFilesInPatch = (patch: string): number => {
  const diffMatches = patch.match(/^diff --git /gm);
  if (diffMatches && diffMatches.length > 0) {
    return diffMatches.length;
  }
  const fileMatches = patch.match(/^\+\+\+ /gm);
  return fileMatches ? fileMatches.length : 0;
};

const normalizeLegacyWrites = (candidate: unknown): ProposalFileWrite[] => {
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

const normalizeLegacyProposal = (candidate: unknown): Proposal | null => {
  const parsed = ProposalSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const writes = normalizeLegacyWrites(record.writes);
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

  // Legacy mixed proposals preferred patch application when both were present.
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

  return null;
};

const normalizeLegacyAgentEditProposal = (candidate: unknown): AgentEditProposal | null => {
  const parsed = AgentEditProposalSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const summary =
    typeof record.summary === 'string' && record.summary.trim().length > 0
      ? record.summary.trim()
      : 'Edit proposal';
  const proposal = normalizeLegacyProposal(record.proposal);
  if (!proposal) {
    return null;
  }

  return {
    summary,
    mode: proposal.mode,
    changeSummary: proposal.summary,
    proposal,
  };
};

const normalizeConversationEntry = (entry: unknown): AgentConversationEntry | null => {
  const parsed = AgentConversationEntrySchema.safeParse(entry);
  if (parsed.success) {
    return stripProposalContent(parsed.data);
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  if (record.type !== 'proposal') {
    return null;
  }

  const proposal = normalizeLegacyAgentEditProposal(record.proposal);
  if (!proposal) {
    return null;
  }

  return AgentConversationProposalEntrySchema.parse({
    id: record.id,
    conversationId: record.conversationId,
    type: 'proposal',
    proposal: toStoredAgentEditProposal(proposal),
    state: record.state,
    createdAt: record.createdAt,
    appliedAt: record.appliedAt,
    discardedAt: record.discardedAt,
    failedAt: record.failedAt,
    failureMessage: record.failureMessage,
  });
};

export const toStoredAgentEditProposal = (proposal: AgentEditProposal): AgentEditProposal => {
  const content = proposal.proposal;
  return {
    summary: proposal.summary,
    mode: content?.mode ?? proposal.mode,
    changeSummary: content?.summary ?? proposal.changeSummary,
  };
};

export const stripProposalContent = (entry: AgentConversationEntry): AgentConversationEntry => {
  if (entry.type !== 'proposal') {
    return entry;
  }

  return AgentConversationProposalEntrySchema.parse({
    ...entry,
    proposal: toStoredAgentEditProposal(entry.proposal),
  });
};

export const hydrateProposalEntry = (
  entry: AgentConversationProposalEntry,
  proposalCache: ProposalCache
): AgentConversationProposalEntry => {
  const content = proposalCache.get(entry.id) ?? entry.proposal.proposal;
  if (!content) {
    return AgentConversationProposalEntrySchema.parse({
      ...entry,
      proposal: toStoredAgentEditProposal(entry.proposal),
    });
  }

  return AgentConversationProposalEntrySchema.parse({
    ...entry,
    proposal: {
      summary: entry.proposal.summary,
      mode: content.mode,
      changeSummary: content.summary,
      proposal: content,
    },
  });
};

export const resolveProposalContent = (
  entry: AgentConversationProposalEntry,
  proposalCache: ProposalCache
): Proposal | null => {
  return proposalCache.get(entry.id) ?? entry.proposal.proposal ?? null;
};

export const normalizeConversationEntries = (
  entries: Record<string, AgentConversationEntry[]>,
  conversations: Record<string, AgentConversation>,
  maxEntries: number
): Record<string, AgentConversationEntry[]> => {
  const normalized: Record<string, AgentConversationEntry[]> = {};
  for (const [conversationId, entryList] of Object.entries(entries)) {
    const list = Array.isArray(entryList) ? entryList : [];
    const parsed = list
      .map((entry) => normalizeConversationEntry(entry))
      .filter((entry): entry is AgentConversationEntry => Boolean(entry));
    normalized[conversationId] =
      parsed.length > maxEntries ? parsed.slice(-maxEntries) : parsed;
  }
  for (const conversationId of Object.keys(conversations)) {
    if (!normalized[conversationId]) {
      normalized[conversationId] = [];
    }
  }
  return normalized;
};
