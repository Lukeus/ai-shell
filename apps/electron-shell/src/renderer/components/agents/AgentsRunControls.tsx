import { Input, Select } from 'packages-ui-kit';

type AgentsRunControlsProps = {
  goal: string;
  onGoalChange: (value: string) => void;
  connectionOptions: Array<{ value: string; label: string }>;
  selectedConnectionId: string;
  onConnectionChange: (value: string) => void;
  skillOptions: Array<{ value: string; label: string }>;
  selectedSkillId: string;
  onSkillChange: (value: string) => void;
  defaultSkillId: string | null;
  lastUsedSkillId: string | null;
  isConnectionsLoading: boolean;
  isSkillsLoading: boolean;
  connectionsError: string | null;
  skillsError: string | null;
  isBusy: boolean;
  activeRunId: string | null;
  errorMessage: string | null;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export function AgentsRunControls({
  goal,
  onGoalChange,
  connectionOptions,
  selectedConnectionId,
  onConnectionChange,
  skillOptions,
  selectedSkillId,
  onSkillChange,
  defaultSkillId,
  lastUsedSkillId,
  isConnectionsLoading,
  isSkillsLoading,
  connectionsError,
  skillsError,
  isBusy,
  activeRunId,
  errorMessage,
  onStart,
  onCancel,
  onRetry,
}: AgentsRunControlsProps) {
  return (
    <div
      className="border-b border-border-subtle bg-surface-secondary shrink-0"
      style={{
        paddingLeft: 'var(--vscode-space-3)',
        paddingRight: 'var(--vscode-space-3)',
        paddingTop: 'var(--vscode-space-2)',
        paddingBottom: 'var(--vscode-space-2)',
      }}
    >
      <div
        className="uppercase text-secondary"
        style={{
          fontSize: 'var(--vscode-font-size-small)',
          letterSpacing: '0.08em',
          marginBottom: 'var(--vscode-space-2)',
        }}
      >
        Start a run
      </div>
      <Input
        type="text"
        value={goal}
        onChange={(value) => onGoalChange(String(value))}
        placeholder="Describe the goal..."
        className="
          w-full mb-[var(--vscode-space-2)]
          bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]
          placeholder:text-tertiary
        "
      />
      <div style={{ marginBottom: 'var(--vscode-space-2)' }}>
        <div
          className="uppercase text-secondary"
          style={{
            fontSize: 'var(--vscode-font-size-small)',
            letterSpacing: '0.08em',
            marginBottom: 'var(--vscode-space-1)',
          }}
        >
          Connection
        </div>
        <Select
          value={selectedConnectionId}
          onChange={onConnectionChange}
          options={connectionOptions}
          disabled={isBusy || isConnectionsLoading}
          className="w-full bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]"
        />
        <div
          className="text-secondary"
          style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-1)' }}
        >
          Uses the default connection when empty.
        </div>
        {connectionsError ? (
          <div
            className="text-error"
            style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-1)' }}
          >
            {connectionsError}
          </div>
        ) : null}
      </div>
      <div style={{ marginBottom: 'var(--vscode-space-2)' }}>
        <div
          className="uppercase text-secondary"
          style={{
            fontSize: 'var(--vscode-font-size-small)',
            letterSpacing: '0.08em',
            marginBottom: 'var(--vscode-space-1)',
          }}
        >
          Skill
        </div>
        <Select
          value={selectedSkillId}
          onChange={onSkillChange}
          options={skillOptions}
          disabled={isBusy || isSkillsLoading}
          className="w-full bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]"
        />
        <div
          className="text-secondary"
          style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-1)' }}
        >
          Auto uses {lastUsedSkillId ? 'last used first' : 'default'} when this is empty.
        </div>
        {defaultSkillId ? (
          <div
            className="text-secondary"
            style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-1)' }}
          >
            Default: {defaultSkillId}
          </div>
        ) : null}
        {lastUsedSkillId ? (
          <div
            className="text-secondary"
            style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-1)' }}
          >
            Last used: {lastUsedSkillId}
          </div>
        ) : null}
        {skillsError ? (
          <div
            className="text-error"
            style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-1)' }}
          >
            {skillsError}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="
            h-[var(--size-list-row)] rounded-none uppercase tracking-wide
            bg-accent text-[var(--vscode-button-foreground)]
            text-[var(--vscode-font-size-small)]
            disabled:opacity-60
            focus:outline-none focus:ring-1 focus:ring-accent
            px-[var(--vscode-space-3)]
          "
        >
          Start
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!activeRunId || isBusy}
          className="
            h-[var(--size-list-row)] rounded-none uppercase tracking-wide
            border border-border-subtle text-secondary
            text-[var(--vscode-font-size-small)]
            hover:text-primary hover:border-border
            disabled:opacity-60
            focus:outline-none focus:ring-1 focus:ring-accent
            px-[var(--vscode-space-3)]
          "
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={!activeRunId || isBusy}
          className="
            h-[var(--size-list-row)] rounded-none uppercase tracking-wide
            border border-border-subtle text-secondary
            text-[var(--vscode-font-size-small)]
            hover:text-primary hover:border-border
            disabled:opacity-60
            focus:outline-none focus:ring-1 focus:ring-accent
            px-[var(--vscode-space-3)]
          "
        >
          Retry
        </button>
      </div>
      {errorMessage ? (
        <div
          className="text-error"
          style={{ fontSize: 'var(--vscode-font-size-small)', marginTop: 'var(--vscode-space-2)' }}
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
