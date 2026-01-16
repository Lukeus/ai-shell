import React from 'react';
import { SddActivitySection } from './SddActivitySection';
import { SddFeatureListSection } from './SddFeatureListSection';
import { SddFileListSection } from './SddFileListSection';
import { SddFileTraceSection } from './SddFileTraceSection';
import { SddPanelHeader } from './SddPanelHeader';
import { SddParitySection } from './SddParitySection';
import { SddProposalSection } from './SddProposalSection';
import { SddTaskListSection } from './SddTaskListSection';
import type { SddPanelViewProps } from './SddPanel.types';
import { SddWorkflowSection } from './SddWorkflowSection';

export function SddPanelView({ state, actions }: SddPanelViewProps) {
  if (!state.hasWorkspace) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-surface">
        <div
          className="flex items-center justify-center flex-1 text-center text-secondary animate-fade-in"
          style={{
            paddingLeft: 'var(--vscode-space-4)',
            paddingRight: 'var(--vscode-space-4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="codicon codicon-checklist text-2xl opacity-50" aria-hidden="true" />
            <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              Open a workspace to view SDD.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!state.enabled) {
    return (
      <div className="flex flex-col h-full w-full min-h-0 bg-surface">
        <div
          className="flex items-center justify-center flex-1 text-center text-secondary animate-fade-in"
          style={{
            paddingLeft: 'var(--vscode-space-4)',
            paddingRight: 'var(--vscode-space-4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="codicon codicon-shield text-2xl opacity-50" aria-hidden="true" />
            <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              SDD is disabled. Enable it in Settings to start tracing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-surface">
      <SddPanelHeader
        workflowStatusLabel={state.workflowStatusLabel}
        workflowRunId={state.workflowRunId}
      />

      <div className="flex-1 min-h-0 overflow-auto w-full">
        {state.workflowError && (
          <div
            className="text-status-error"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {state.workflowError}
          </div>
        )}

        {!state.workflowSupported && (
          <div
            className="text-tertiary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            SDD workflow is unavailable in this build.
          </div>
        )}

        <SddWorkflowSection
          workflowStatusLabel={state.workflowStatusLabel}
          workflowFeatureId={state.workflow.featureId}
          workflowGoal={state.workflow.goal}
          workflowStep={state.workflow.step}
          workflowCommand={state.workflow.command}
          customCommands={state.workflow.customCommands}
          customCommandErrors={state.workflow.customCommandErrors}
          isRunning={state.workflow.isRunning}
          isStarting={state.workflow.isStarting}
          canStart={state.workflowSupported}
          onFeatureIdChange={actions.onWorkflowFeatureIdChange}
          onGoalChange={actions.onWorkflowGoalChange}
          onStepChange={actions.onWorkflowStepChange}
          onSlashCommandChange={actions.onWorkflowCommandChange}
          onStart={actions.onWorkflowStart}
          onCancel={actions.onWorkflowCancel}
        />

        <SddActivitySection
          events={state.activity.events}
          totalCount={state.activity.totalCount}
        />

        {state.workflow.proposal && (
          <SddProposalSection
            proposal={state.workflow.proposal}
            runId={state.workflowRunId}
            onApply={actions.onWorkflowApplyProposal}
            isApplying={state.workflow.isApplying}
          />
        )}

        {state.error && (
          <div
            className="text-status-error"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {state.error}
          </div>
        )}

        <SddFeatureListSection
          features={state.features.items}
          selectedFeatureId={state.features.selectedId}
          isLoading={state.features.isLoading}
          onSelect={actions.onSelectFeature}
        />

        <SddTaskListSection
          tasks={state.tasks.items}
          selectedTaskId={state.tasks.selectedId}
          isLoading={state.tasks.isLoading}
          hasFeature={state.tasks.hasFeature}
          onSelect={actions.onSelectTask}
        />

        <SddParitySection
          trackedRatio={state.parity.trackedRatio}
          trackedChanges={state.parity.trackedChanges}
          untrackedChanges={state.parity.untrackedChanges}
          driftFilesCount={state.parity.driftFiles.length}
          staleDocsCount={state.parity.staleDocs.length}
          onReconcile={actions.onReconcileDrift}
        />

        <SddFileListSection
          title="Drift Files"
          files={state.parity.driftFiles}
          emptyText="No untracked changes detected."
          onOpenFile={actions.onOpenFile}
          formatPath={actions.formatPath}
        />

        <SddFileListSection
          title="Stale Docs"
          files={state.parity.staleDocs}
          emptyText="No stale docs detected."
          onOpenFile={actions.onOpenFile}
          formatPath={actions.formatPath}
        />

        <SddFileTraceSection
          selectedEntry={state.fileTrace.selectedEntry}
          fileTrace={state.fileTrace.trace}
        />
      </div>
    </div>
  );
}
