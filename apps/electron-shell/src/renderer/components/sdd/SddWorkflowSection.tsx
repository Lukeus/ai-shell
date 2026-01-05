import React from 'react';
import type { SddStep } from 'packages-api-contracts';
import { SddRunControls } from './SddRunControls';

type SddWorkflowSectionProps = {
  workflowStatusLabel: string;
  workflowFeatureId: string;
  workflowGoal: string;
  workflowStep: SddStep;
  workflowCommand: string;
  customCommands: string[];
  customCommandErrors: string[];
  isRunning: boolean;
  isStarting: boolean;
  canStart: boolean;
  onFeatureIdChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onStepChange: (value: SddStep) => void;
  onSlashCommandChange: (value: string) => void;
  onStart: () => void;
  onCancel: () => void;
};

export function SddWorkflowSection({
  workflowStatusLabel,
  workflowFeatureId,
  workflowGoal,
  workflowStep,
  workflowCommand,
  customCommands,
  customCommandErrors,
  isRunning,
  isStarting,
  canStart,
  onFeatureIdChange,
  onGoalChange,
  onStepChange,
  onSlashCommandChange,
  onStart,
  onCancel,
}: SddWorkflowSectionProps) {
  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          Workflow
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {workflowStatusLabel}
        </span>
      </div>
      <div style={{ padding: 'var(--vscode-space-3)' }}>
        <SddRunControls
          featureId={workflowFeatureId}
          goal={workflowGoal}
          step={workflowStep}
          slashCommand={workflowCommand}
          customCommands={customCommands}
          customCommandErrors={customCommandErrors}
          isRunning={isRunning}
          isStarting={isStarting}
          canStart={canStart}
          onFeatureIdChange={onFeatureIdChange}
          onGoalChange={onGoalChange}
          onStepChange={onStepChange}
          onSlashCommandChange={onSlashCommandChange}
          onStart={onStart}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
