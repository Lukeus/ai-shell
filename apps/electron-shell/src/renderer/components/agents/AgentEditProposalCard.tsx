import { useMemo, useState } from 'react';
import type {
  AgentConversationProposalEntry,
  Proposal,
} from 'packages-api-contracts';
import { ProposalDiffView } from '../sdd/ProposalDiffView';
import styles from '../../styles/agents/AgentEditProposalCard.module.css';

type PersistedApplyResult = {
  files: string[];
  summary: AgentConversationProposalEntry['proposal']['changeSummary'];
  state: 'applied';
  appliedAt: string;
};

type AgentEditProposalCardProps = {
  entry: AgentConversationProposalEntry;
  canApply: boolean;
  isApplying: boolean;
  isDiscarded: boolean;
  applyResult: PersistedApplyResult | null;
  applyError: string | null;
  onApply: () => void;
  onDiscard: () => void;
};

const MAX_EAGER_DIFF_CHARS = 8000;

const buildSummaryLine = (
  summary: AgentConversationProposalEntry['proposal']['changeSummary']
): string => {
  const summaryParts = [`Files changed: ${summary.filesChanged}`];
  if (summary.additions !== undefined) {
    summaryParts.push(`+${summary.additions}`);
  }
  if (summary.deletions !== undefined) {
    summaryParts.push(`-${summary.deletions}`);
  }
  return summaryParts.join(' ');
};

const estimateDiffSize = (proposal: Proposal): number => {
  if (proposal.mode === 'writes') {
    return proposal.writes.reduce((total, write) => total + write.content.length, 0);
  }
  return proposal.patch.length;
};

export function AgentEditProposalCard({
  entry,
  canApply,
  isApplying,
  isDiscarded,
  applyResult,
  applyError,
  onApply,
  onDiscard,
}: AgentEditProposalCardProps) {
  const { proposal, summary, changeSummary } = entry.proposal;
  const summaryLine = useMemo(() => buildSummaryLine(changeSummary), [changeSummary]);
  const diffSize = useMemo(() => (proposal ? estimateDiffSize(proposal) : 0), [proposal]);
  const shouldCollapse = diffSize > MAX_EAGER_DIFF_CHARS;
  const [isExpanded, setIsExpanded] = useState(!shouldCollapse);
  const canInteract = !applyResult && !isDiscarded;
  const canApplyProposal = Boolean(proposal) && canApply && !isApplying && canInteract;
  const canDiscardProposal = !applyResult && !isDiscarded;
  const applyLabel =
    entry.state === 'failed' ? 'Retry Apply' : applyResult ? 'Applied' : 'Apply';
  const contentUnavailable =
    !proposal && entry.state !== 'applied' && entry.state !== 'discarded';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span>Edit proposal</span>
        <span>{summaryLine}</span>
      </div>
      <div className={styles.summary}>{summary}</div>
      {applyResult ? (
        <div className={styles.applied}>
          Applied to {applyResult.summary.filesChanged} files.
        </div>
      ) : null}
      {isDiscarded ? (
        <div className={styles.discarded}>Discarded.</div>
      ) : null}
      {applyError ? (
        <div className={styles.error}>{applyError}</div>
      ) : null}
      {!canApply ? (
        <div className={styles.notice}>Open a workspace to apply edits.</div>
      ) : null}
      {contentUnavailable ? (
        <div className={styles.notice}>
          Proposal content is unavailable for this session. Regenerate it to apply.
        </div>
      ) : null}
      {proposal && shouldCollapse && !isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={styles.toggle}
        >
          Show diff
        </button>
      ) : proposal ? (
        <ProposalDiffView proposal={proposal} />
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onApply}
          disabled={!canApplyProposal}
          className={styles.applyButton}
        >
          {isApplying ? 'Applying...' : applyLabel}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!canDiscardProposal}
          className={styles.discardButton}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
