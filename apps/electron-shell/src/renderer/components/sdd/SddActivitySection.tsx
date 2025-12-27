import React from 'react';
import type { SddRunEvent } from 'packages-api-contracts';

type SddActivitySectionProps = {
  events: SddRunEvent[];
  totalCount: number;
};

const formatEventLabel = (event: SddRunEvent): string => {
  switch (event.type) {
    case 'started':
      return `Started ${event.featureId} (${event.step})`;
    case 'contextLoaded':
      return 'Context loaded';
    case 'stepStarted':
      return `Step started: ${event.step}`;
    case 'outputAppended':
      return 'Output appended';
    case 'proposalReady':
      return 'Proposal ready';
    case 'approvalRequired':
      return 'Approval required';
    case 'proposalApplied':
      return 'Proposal applied';
    case 'testsRequested':
      return `Tests requested: ${event.command}`;
    case 'testsCompleted':
      return `Tests completed (${event.exitCode})`;
    case 'runCompleted':
      return 'Run completed';
    case 'runFailed':
      return `Run failed: ${event.message}`;
    default:
      return (event as any).type;
  }
};

export function SddActivitySection({ events, totalCount }: SddActivitySectionProps) {
  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          Activity
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {totalCount}
        </span>
      </div>

      {events.length === 0 ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          No workflow events yet.
        </div>
      ) : (
        <div className="flex flex-col">
          {events.map((event) => (
            <div
              key={event.id}
              className="text-secondary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
                borderTop: '1px solid var(--vscode-border-subtle)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-primary">{formatEventLabel(event)}</span>
                <span className="text-tertiary">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {event.type === 'outputAppended' && (
                <div className="text-tertiary" style={{ marginTop: 'var(--vscode-space-1)' }}>
                  {event.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
