import { Select } from 'packages-ui-kit';

type AgentsRunControlsProps = {
  goal: string;
  onGoalChange: (value: string) => void;
  connectionOptions: Array<{ value: string; label: string }>;
  selectedConnectionId: string;
  onConnectionChange: (value: string) => void;
  isConnectionsLoading: boolean;
  connectionsError: string | null;
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
  isConnectionsLoading,
  connectionsError,
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
      <input
        type="text"
        value={goal}
        onChange={(event) => onGoalChange(event.target.value)}
        placeholder="Describe the goal..."
        className="
          w-full rounded-none
          bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-primary
          placeholder:text-tertiary
          focus:outline-none focus:ring-1 focus:ring-accent
        "
        style={{
          height: 'var(--vscode-list-rowHeight)',
          paddingLeft: 'var(--vscode-space-2)',
          paddingRight: 'var(--vscode-space-2)',
          fontSize: 'var(--vscode-font-size-ui)',
          marginBottom: 'var(--vscode-space-2)',
        }}
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="
            rounded-none uppercase tracking-wide
            bg-accent text-[var(--vscode-button-foreground)]
            disabled:opacity-60
          "
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Start
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!activeRunId || isBusy}
          className="
            rounded-none uppercase tracking-wide
            border border-border-subtle text-secondary
            hover:text-primary hover:border-border
            disabled:opacity-60
          "
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={!activeRunId || isBusy}
          className="
            rounded-none uppercase tracking-wide
            border border-border-subtle text-secondary
            hover:text-primary hover:border-border
            disabled:opacity-60
          "
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingTop: 'var(--vscode-space-1)',
            paddingBottom: 'var(--vscode-space-1)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
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
