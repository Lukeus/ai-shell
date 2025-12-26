import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentEvent, AgentRunMetadata, Connection } from 'packages-api-contracts';
import { Select } from 'packages-ui-kit';
import { AgentRunList } from './AgentRunList';
import { AgentPlanTodos } from './AgentPlanTodos';
import { AgentEventStream } from './AgentEventStream';

const sortRunsByUpdatedAt = (runs: AgentRunMetadata[]) =>
  [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const chooseRunId = (
  runs: AgentRunMetadata[],
  preferredId: string | null
): string | null => {
  if (preferredId && runs.some((run) => run.id === preferredId)) {
    return preferredId;
  }
  if (runs.length === 0) {
    return null;
  }
  return sortRunsByUpdatedAt(runs)[0].id;
};

export function AgentsPanel() {
  const [runs, setRuns] = useState<AgentRunMetadata[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [goal, setGoal] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(true);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedRuns = useMemo(() => sortRunsByUpdatedAt(runs), [runs]);
  const activeRunId = chooseRunId(sortedRuns, selectedRunId);

  const refreshRuns = useCallback(
    async (preferredId?: string | null) => {
      try {
        const response = await window.api.agents.listRuns();
        setRuns(response.runs);
        const nextId = chooseRunId(response.runs, preferredId ?? selectedRunId);
        setSelectedRunId(nextId);
        setErrorMessage(null);
      } catch {
        setErrorMessage('Failed to load agent runs.');
      }
    },
    [selectedRunId]
  );

  const refreshConnections = useCallback(async () => {
    try {
      setConnectionsError(null);
      const response = await window.api.connections.list();
      setConnections(response.connections);
    } catch {
      setConnectionsError('Failed to load connections.');
    } finally {
      setIsConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRuns(null);
  }, [refreshRuns]);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    if (
      selectedConnectionId &&
      !connections.some((connection) => connection.metadata.id === selectedConnectionId)
    ) {
      setSelectedConnectionId('');
    }
  }, [connections, selectedConnectionId]);

  useEffect(() => {
    if (!activeRunId) {
      setEvents([]);
      return;
    }

    let isActive = true;
    const loadTrace = async () => {
      try {
        const response = await window.api.agents.listTrace({ runId: activeRunId });
        if (isActive) {
          setEvents(response.events);
        }
      } catch {
        if (isActive) {
          setEvents([]);
        }
      }
    };

    void loadTrace();
    void window.api.agents.subscribeEvents({ runId: activeRunId });

    const unsubscribe = window.api.agents.onEvent((event) => {
      if (event.runId !== activeRunId) {
        return;
      }
      setEvents((prev) => [...prev, event].slice(-200));
      if (event.type === 'status') {
        setRuns((prev) =>
          prev.map((run) =>
            run.id === event.runId
              ? { ...run, status: event.status, updatedAt: event.timestamp }
              : run
          )
        );
      }
      if (event.type === 'error') {
        setErrorMessage(event.message);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
      void window.api.agents.unsubscribeEvents({ runId: activeRunId });
    };
  }, [activeRunId]);

  const connectionOptions = useMemo(() => {
    if (isConnectionsLoading) {
      return [{ value: '', label: 'Loading connections...' }];
    }

    const baseOptions = [{ value: '', label: 'Use default connection' }];
    const connectionOptionList = connections.map((connection) => ({
      value: connection.metadata.id,
      label: `${connection.metadata.displayName} (${connection.metadata.providerId})`,
    }));

    return baseOptions.concat(connectionOptionList);
  }, [connections, isConnectionsLoading]);

  const connectionLookup = useMemo(() => {
    return new Map(connections.map((connection) => [connection.metadata.id, connection]));
  }, [connections]);

  const handleStartRun = async () => {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setErrorMessage('Enter a goal to start a run.');
      return;
    }
    if (selectedConnectionId && !connectionLookup.has(selectedConnectionId)) {
      setErrorMessage('Selected connection is no longer available.');
      return;
    }
    setIsBusy(true);
    try {
      const request = {
        goal: trimmedGoal,
        ...(selectedConnectionId ? { connectionId: selectedConnectionId } : {}),
      };
      const response = await window.api.agents.startRun(request);
      setGoal('');
      await refreshRuns(response.run.id);
    } catch {
      setErrorMessage('Failed to start agent run.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelRun = async () => {
    if (!activeRunId) {
      return;
    }
    setIsBusy(true);
    try {
      await window.api.agents.cancelRun({ runId: activeRunId, action: 'cancel' });
      await refreshRuns(activeRunId);
    } catch {
      setErrorMessage('Failed to cancel agent run.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetryRun = async () => {
    if (!activeRunId) {
      return;
    }
    setIsBusy(true);
    try {
      await window.api.agents.retryRun({ runId: activeRunId, action: 'retry' });
      await refreshRuns(activeRunId);
    } catch {
      setErrorMessage('Failed to retry agent run.');
    } finally {
      setIsBusy(false);
    }
  };

  const activeRun = sortedRuns.find((run) => run.id === activeRunId) ?? null;
  const routingLabel = useMemo(() => {
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
  }, [activeRun, connectionLookup]);

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-surface">
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
          onChange={(event) => setGoal(event.target.value)}
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
            onChange={setSelectedConnectionId}
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
            onClick={handleStartRun}
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
            onClick={handleCancelRun}
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
            onClick={handleRetryRun}
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

      <AgentRunList
        runs={sortedRuns}
        selectedRunId={activeRunId}
        onSelect={setSelectedRunId}
      />

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


