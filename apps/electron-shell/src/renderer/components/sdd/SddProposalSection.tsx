import React from 'react';
import type { Proposal } from 'packages-api-contracts';
import { ProposalDiffView } from './ProposalDiffView';

type SddProposalSectionProps = {
  proposal: Proposal;
  runId: string | null;
  onApply: () => void;
  isApplying: boolean;
};

export function SddProposalSection({
  proposal,
  runId,
  onApply,
  isApplying,
}: SddProposalSectionProps) {
  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          Proposal
        </span>
        <span
          className="text-tertiary"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          {proposal.summary.filesChanged} files
        </span>
      </div>
      <div style={{ padding: 'var(--vscode-space-3)' }}>
        <ProposalDiffView
          proposal={proposal}
          onApply={onApply}
          isApplying={isApplying}
          canApply={Boolean(runId)}
        />
      </div>
    </div>
  );
}
