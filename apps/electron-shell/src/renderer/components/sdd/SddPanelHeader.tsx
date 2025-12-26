import React from 'react';

type SddPanelHeaderProps = {
  workflowStatusLabel: string;
  workflowRunId: string | null;
};

export function SddPanelHeader({ workflowStatusLabel, workflowRunId }: SddPanelHeaderProps) {
  return (
    <div
      className="border-b border-border-subtle bg-surface-secondary shrink-0"
      style={{ padding: 'var(--vscode-space-3)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="codicon codicon-checklist text-secondary" aria-hidden="true" />
          <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
            Spec-driven development
          </span>
        </div>
        <span
          className="text-tertiary"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          Workflow: {workflowStatusLabel}
        </span>
      </div>

      <div
        className="mt-2 text-tertiary"
        style={{ fontSize: 'var(--vscode-font-size-small)' }}
      >
        {workflowRunId ? `Run ID: ${workflowRunId.slice(0, 8)}...` : 'No active workflow run.'}
      </div>
    </div>
  );
}
