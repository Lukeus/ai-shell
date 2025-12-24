import React from 'react';
import type { Proposal } from 'packages-api-contracts';

type ProposalDiffViewProps = {
  proposal: Proposal;
  onApply?: () => void;
  isApplying?: boolean;
  canApply?: boolean;
};

export function ProposalDiffView({
  proposal,
  onApply,
  isApplying = false,
  canApply = true,
}: ProposalDiffViewProps) {
  const summaryText = [
    `Files changed: ${proposal.summary.filesChanged}`,
    proposal.summary.additions !== undefined ? `+${proposal.summary.additions}` : null,
    proposal.summary.deletions !== undefined ? `-${proposal.summary.deletions}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {summaryText}
        </span>
        {onApply && (
          <button
            onClick={onApply}
            disabled={!canApply || isApplying}
            className="
              rounded-sm bg-accent text-primary
              hover:bg-accent-hover active:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-1)',
              paddingBottom: 'var(--vscode-space-1)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {isApplying ? 'Applying...' : 'Apply'}
          </button>
        )}
      </div>

      {proposal.writes.length > 0 && (
        <div className="flex flex-col gap-3">
          {proposal.writes.map((write) => (
            <div key={write.path} className="flex flex-col gap-2">
              <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
                {write.path}
              </span>
              <pre
                className="rounded-sm bg-surface-elevated text-tertiary overflow-auto"
                style={{
                  padding: 'var(--vscode-space-2)',
                  fontSize: 'var(--vscode-font-size-small)',
                  maxHeight: '240px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {write.content}
              </pre>
            </div>
          ))}
        </div>
      )}

      {proposal.patch && (
        <div className="flex flex-col gap-2">
          <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
            Unified diff
          </span>
          <pre
            className="rounded-sm bg-surface-elevated text-tertiary overflow-auto"
            style={{
              padding: 'var(--vscode-space-2)',
              fontSize: 'var(--vscode-font-size-small)',
              maxHeight: '240px',
              whiteSpace: 'pre',
            }}
          >
            {proposal.patch}
          </pre>
        </div>
      )}
    </div>
  );
}
