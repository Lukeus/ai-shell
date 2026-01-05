import React from 'react';
import type { FileEntry, SddFileTraceResponse } from 'packages-api-contracts';

type SelectedEntry = { path: string; type: FileEntry['type'] } | null;

type SddFileTraceSectionProps = {
  selectedEntry: SelectedEntry;
  fileTrace: SddFileTraceResponse | null;
};

export function SddFileTraceSection({ selectedEntry, fileTrace }: SddFileTraceSectionProps) {
  return (
    <div>
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          File Trace
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {fileTrace?.runs.length ?? 0}
        </span>
      </div>
      {!selectedEntry || selectedEntry.type !== 'file' ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Select a file to view trace details.
        </div>
      ) : !fileTrace || fileTrace.runs.length === 0 ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          No trace recorded for this file.
        </div>
      ) : (
        <div className="flex flex-col">
          {fileTrace.runs.map((run) => (
            <div
              key={run.runId}
              className="flex items-center justify-between text-secondary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              <span className="text-primary">{`${run.featureId} / ${run.taskId}`}</span>
              <span className="text-tertiary">{run.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
