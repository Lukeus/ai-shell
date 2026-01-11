import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentEvent, AgentRunMetadata } from 'packages-api-contracts';
import { useConnectionsContext } from '../contexts/ConnectionsContext';
import { describeMissingConnection, resolveAgentConnection } from '../utils/agentConnections';

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

type UseAgentRunsResult = {
  runs: AgentRunMetadata[];
  activeRunId: string | null;
  activeRun: AgentRunMetadata | null;
  events: AgentEvent[];
  isBusy: boolean;
  errorMessage: string | null;
  refreshRuns: (preferredId?: string | null) => Promise<void>;
  setSelectedRunId: (runId: string | null) => void;
  startRun: (goal: string, connectionId?: string) => Promise<void>;
  cancelRun: () => Promise<void>;
  retryRun: () => Promise<void>;
  handleAgentEvent: (event: AgentEvent) => void;
};

export function useAgentRuns(): UseAgentRunsResult {
  const { requestSecretAccess } = useConnectionsContext();
  const [runs, setRuns] = useState<AgentRunMetadata[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolveRunConnection = useCallback(
    async (explicitConnectionId?: string) => {
      const [connectionsResponse, settings] = await Promise.all([
        window.api.connections.list(),
        window.api.getSettings(),
      ]);
      const resolution = resolveAgentConnection({
        connections: connectionsResponse.connections,
        settings,
        explicitConnectionId,
      });
      return { ...resolution, connections: connectionsResponse.connections, settings };
    },
    []
  );

  const sortedRuns = useMemo(() => sortRunsByUpdatedAt(runs), [runs]);
  const activeRunId = chooseRunId(sortedRuns, selectedRunId);
  const activeRun = sortedRuns.find((run) => run.id === activeRunId) ?? null;

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

  useEffect(() => {
    void refreshRuns(null);
  }, [refreshRuns]);

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
    return () => {
      isActive = false;
    };
  }, [activeRunId]);

  const startRun = useCallback(
    async (goal: string, connectionId?: string) => {
      const trimmedGoal = goal.trim();
      if (!trimmedGoal) {
        setErrorMessage('Enter a goal to start a run.');
        return;
      }
      setIsBusy(true);
      try {
        const { connectionId: resolvedConnectionId, connections, settings } =
          await resolveRunConnection(connectionId);
        if (!resolvedConnectionId) {
          setErrorMessage(
            describeMissingConnection({
              connections,
              settings,
              explicitConnectionId: connectionId ?? null,
            })
          );
          return;
        }

        const access = await requestSecretAccess({
          connectionId: resolvedConnectionId,
          requesterId: 'agent-host',
          reason: 'agent.run',
        });
        if (!access.granted) {
          setErrorMessage('Secret access denied for this connection.');
          return;
        }

        const request = {
          goal: trimmedGoal,
          ...(connectionId ? { connectionId } : {}),
        };
        const response = await window.api.agents.startRun(request);
        setErrorMessage(null);
        await refreshRuns(response.run.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start agent run.';
        setErrorMessage(message);
      } finally {
        setIsBusy(false);
      }
    },
    [refreshRuns, requestSecretAccess, resolveRunConnection]
  );

  const cancelRun = useCallback(async () => {
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
  }, [activeRunId, refreshRuns]);

  const retryRun = useCallback(async () => {
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
  }, [activeRunId, refreshRuns]);

  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type === 'status') {
        setRuns((prev) =>
          prev.map((run) =>
            run.id === event.runId
              ? { ...run, status: event.status, updatedAt: event.timestamp }
              : run
          )
        );
      }

      if (event.runId === activeRunId) {
        setEvents((prev) => [...prev, event].slice(-200));
        if (event.type === 'error') {
          setErrorMessage(event.message);
        }
      }
    },
    [activeRunId]
  );

  return {
    runs: sortedRuns,
    activeRunId,
    activeRun,
    events,
    isBusy,
    errorMessage,
    refreshRuns,
    setSelectedRunId,
    startRun,
    cancelRun,
    retryRun,
    handleAgentEvent,
  };
}
