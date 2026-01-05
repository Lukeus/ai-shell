import React from 'react';

export type SddTaskItem = {
  id: string;
  label: string;
};

type SddTaskListSectionProps = {
  tasks: SddTaskItem[];
  selectedTaskId: string | null;
  isLoading: boolean;
  hasFeature: boolean;
  onSelect: (taskId: string) => void;
};

export function SddTaskListSection({
  tasks,
  selectedTaskId,
  isLoading,
  hasFeature,
  onSelect,
}: SddTaskListSectionProps) {
  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          Tasks
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {tasks.length}
        </span>
      </div>

      {isLoading ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          {hasFeature ? 'No tasks found.' : 'Select a feature to view tasks.'}
        </div>
      ) : (
        <div className="flex flex-col">
          {tasks.map((task) => {
            const isSelected = task.id === selectedTaskId;
            return (
              <button
                key={task.id}
                onClick={() => onSelect(task.id)}
                className={`
                  text-left hover:bg-surface-hover
                  transition-colors duration-150
                  ${isSelected ? 'bg-surface-hover text-primary' : 'text-secondary'}
                `}
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingTop: 'var(--vscode-space-2)',
                  paddingBottom: 'var(--vscode-space-2)',
                  fontSize: 'var(--vscode-font-size-small)',
                }}
              >
                {task.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
