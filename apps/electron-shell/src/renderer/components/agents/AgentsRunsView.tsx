import { useMemo, useState } from 'react';
import type { AgentEvent, AgentRunMetadata, Connection } from 'packages-api-contracts';
import { AgentEventStream } from './AgentEventStream';
import { AgentPlanTodos } from './AgentPlanTodos';
import { AgentRunList } from './AgentRunList';
import { AgentsRunControls } from './AgentsRunControls';
import { useConnections } from '../../hooks/useConnections';

type AgentsRunsViewProps = {
  runs: AgentRunMetadata[];
  activeRunId: string | null;
  activeRun: AgentRunMetadata | null;
  events: AgentEvent[];
  isBusy: boolean;
  errorMessage: string | null;
  onSelectRun: (runId: string) => void;
  onStartRun: (goal: string, connectionId?: string) => Promise<void>;
  onCancelRun: () => Promise<void>;
  onRetryRun: () => Promise<void>;
};

const resolveRoutingLabel = (
  activeRun: AgentRunMetadata | null,
  connectionLookup: Map<string, Connection>
) => {
  if (!activeRun?.routing) {
    return null;
  }

  const connection = connectionLookup.get(activeRun.routing.connectionId);
  const connectionName =
    connection?.metadata.displayName ??
    `Connection ${activeRun.routing.connectionId.slice(0, 8)}`;
  const providerId = activeRun.routing.providerId;
  const modelPart = activeRun.routing.modelRef ? ` - ${activeRun.routing.modelRef}` : '';

  return `${connectionName} (${providerId})${modelPart}`;
};

export function AgentsRunsView({
  runs,
  activeRunId,
  activeRun,
  events,
  isBusy,
  errorMessage,
  onSelectRun,
  onStartRun,
  onCancelRun,
  onRetryRun,
}: AgentsRunsViewProps) {
  const [goal, setGoal] = useState('');
  const {
    connectionOptions,
    connectionLookup,
    selectedConnectionId,
    setSelectedConnectionId,
    isLoading,
    error,
  } = useConnections();

  const routingLabel = useMemo(
    () => resolveRoutingLabel(activeRun, connectionLookup),
    [activeRun, connectionLookup]
  );

  const handleStart = async () => {
    await onStartRun(goal, selectedConnectionId || undefined);
    setGoal('');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      <AgentsRunControls
        goal={goal}
        onGoalChange={setGoal}
        connectionOptions={connectionOptions}
        selectedConnectionId={selectedConnectionId}
        onConnectionChange={setSelectedConnectionId}
        isConnectionsLoading={isLoading}
        connectionsError={error}
        isBusy={isBusy}
        activeRunId={activeRunId}
        errorMessage={errorMessage}
        onStart={handleStart}
        onCancel={onCancelRun}
        onRetry={onRetryRun}
      />

      <AgentRunList runs={runs} selectedRunId={activeRunId} onSelect={onSelectRun} />

      <AgentPlanTodos events={events} />

      <div
        className="flex items-center justify-between border-b border-border-subtle"
        style={{
          paddingLeft: 'var(--vscode-space-3)',
          paddingRight: 'var(--vscode-space-3)',
          paddingTop: 'var(--vscode-space-1)',
          paddingBottom: 'var(--vscode-space-1)',
        }}
      >
        <div
          className="uppercase text-secondary"
          style={{ fontSize: 'var(--vscode-font-size-small)', letterSpacing: '0.08em' }}
        >
          Events
        </div>
        {activeRun ? (
          <div className="flex flex-col items-end gap-1">
            <div
              className="uppercase text-secondary"
              style={{ fontSize: '10px', letterSpacing: '0.08em' }}
            >
              {activeRun.status}
            </div>
            {routingLabel ? (
              <div className="text-secondary" style={{ fontSize: '10px' }}>
                {routingLabel}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <AgentEventStream events={events} />
    </div>
  );
}
