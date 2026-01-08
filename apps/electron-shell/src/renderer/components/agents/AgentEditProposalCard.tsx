import { useMemo, useState } from 'react';
import type {
  AgentConversationProposalEntry,
  ApplyAgentEditProposalResponse,
  Proposal,
} from 'packages-api-contracts';
import { ProposalDiffView } from '../sdd/ProposalDiffView';
import styles from '../../styles/agents/AgentEditProposalCard.module.css';

type AgentEditProposalCardProps = {
  entry: AgentConversationProposalEntry;
  canApply: boolean;
  isApplying: boolean;
  isDiscarded: boolean;
  applyResult: ApplyAgentEditProposalResponse | null;
  applyError: string | null;
  onApply: () => void;
  onDiscard: () => void;
};

const MAX_EAGER_DIFF_CHARS = 8000;

const buildSummaryLine = (proposal: Proposal): string => {
  const summaryParts = [`Files changed: ${proposal.summary.filesChanged}`];
  if (proposal.summary.additions !== undefined) {
    summaryParts.push(`+${proposal.summary.additions}`);
  }
  if (proposal.summary.deletions !== undefined) {
    summaryParts.push(`-${proposal.summary.deletions}`);
  }
  return summaryParts.join(' ');
};

const estimateDiffSize = (proposal: Proposal): number => {
  const writeSize = proposal.writes.reduce((total, write) => total + write.content.length, 0);
  return writeSize + (proposal.patch?.length ?? 0);
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
  const { proposal, summary } = entry.proposal;
  const summaryLine = useMemo(() => buildSummaryLine(proposal), [proposal]);
  const diffSize = useMemo(() => estimateDiffSize(proposal), [proposal]);
  const shouldCollapse = diffSize > MAX_EAGER_DIFF_CHARS;
  const [isExpanded, setIsExpanded] = useState(!shouldCollapse);
  const canInteract = !applyResult && !isDiscarded;

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
      {shouldCollapse && !isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={styles.toggle}
        >
          Show diff
        </button>
      ) : (
        <ProposalDiffView proposal={proposal} />
      )}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply || isApplying || !canInteract}
          className={styles.applyButton}
        >
          {isApplying ? 'Applying...' : applyResult ? 'Applied' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!canInteract}
          className={styles.discardButton}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
