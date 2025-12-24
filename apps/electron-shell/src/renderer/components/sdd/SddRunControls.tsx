import React from 'react';
import type { SddStep } from 'packages-api-contracts';

type SddRunControlsProps = {
  featureId: string;
  goal: string;
  step: SddStep;
  slashCommand: string;
  isRunning: boolean;
  isStarting: boolean;
  canStart: boolean;
  onFeatureIdChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onStepChange: (step: SddStep) => void;
  onSlashCommandChange: (value: string) => void;
  onStart: () => void;
  onCancel: () => void;
};

const STEP_OPTIONS: Array<{ id: SddStep; label: string }> = [
  { id: 'spec', label: 'Spec' },
  { id: 'plan', label: 'Plan' },
  { id: 'tasks', label: 'Tasks' },
];

export function SddRunControls({
  featureId,
  goal,
  step,
  slashCommand,
  isRunning,
  isStarting,
  canStart,
  onFeatureIdChange,
  onGoalChange,
  onStepChange,
  onSlashCommandChange,
  onStart,
  onCancel,
}: SddRunControlsProps) {
  const canSubmit = canStart && featureId.trim().length > 0 && goal.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
        Feature ID
        <input
          value={featureId}
          onChange={(event) => onFeatureIdChange(event.target.value)}
          placeholder="151-sdd-workflow"
          className="rounded-sm border border-border-subtle bg-surface text-primary"
          style={{
            paddingLeft: 'var(--vscode-space-2)',
            paddingRight: 'var(--vscode-space-2)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-ui)',
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
        Goal
        <textarea
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          placeholder="Describe the desired outcome for this workflow."
          rows={3}
          className="rounded-sm border border-border-subtle bg-surface text-primary resize-none"
          style={{
            paddingLeft: 'var(--vscode-space-2)',
            paddingRight: 'var(--vscode-space-2)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-ui)',
          }}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          Step
        </span>
        <div className="flex items-center gap-2">
          {STEP_OPTIONS.map((option) => {
            const isActive = option.id === step;
            return (
              <button
                key={option.id}
                onClick={() => onStepChange(option.id)}
                className={`
                  rounded-sm border text-secondary
                  ${isActive ? 'bg-accent text-primary border-border-focus' : 'border-border-subtle'}
                  hover:bg-surface-hover hover:text-primary
                  transition-colors duration-150
                `}
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingTop: 'var(--vscode-space-1)',
                  paddingBottom: 'var(--vscode-space-1)',
                  fontSize: 'var(--vscode-font-size-small)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
        Slash command (optional)
        <input
          value={slashCommand}
          onChange={(event) => onSlashCommandChange(event.target.value)}
          placeholder="/spec, /plan, /tasks"
          className="rounded-sm border border-border-subtle bg-surface text-primary"
          style={{
            paddingLeft: 'var(--vscode-space-2)',
            paddingRight: 'var(--vscode-space-2)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-ui)',
          }}
        />
      </label>

      <div className="flex items-center gap-2">
        {!isRunning && (
          <button
            onClick={onStart}
            disabled={!canSubmit || isStarting}
            className="
              rounded-sm bg-accent text-primary
              hover:bg-accent-hover active:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-2)',
              paddingBottom: 'var(--vscode-space-2)',
              fontSize: 'var(--vscode-font-size-ui)',
            }}
          >
            {isStarting ? 'Starting...' : 'Start Workflow'}
          </button>
        )}
        {isRunning && (
          <button
            onClick={onCancel}
            className="
              rounded-sm border border-border-subtle text-secondary
              hover:bg-surface-hover hover:text-primary
              active:opacity-90 transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-2)',
              paddingBottom: 'var(--vscode-space-2)',
              fontSize: 'var(--vscode-font-size-ui)',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
