import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentEvent, AgentRunMetadata } from 'packages-api-contracts';
import { AgentRunList } from './AgentRunList';
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
    });

    return () => {
      isActive = false;
      unsubscribe();
      void window.api.agents.unsubscribeEvents({ runId: activeRunId });
    };
  }, [activeRunId]);

  const handleStartRun = async () => {
    if (!goal.trim()) {
      setErrorMessage('Enter a goal to start a run.');
      return;
    }
    setIsBusy(true);
    try {
      const response = await window.api.agents.startRun({ goal: goal.trim() });
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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border-subtle px-4 py-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-secondary">
          Start a run
        </div>
        <input
          type="text"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Describe the goal..."
          className="
            w-full h-8 px-3 text-[13px] rounded-none
            bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-primary
            placeholder:text-tertiary
            focus:outline-none focus:ring-1 focus:ring-accent
          "
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartRun}
            disabled={isBusy}
            className="
              px-3 py-1.5 text-[11px] uppercase tracking-wide rounded-none
              bg-accent text-white
              disabled:opacity-60
            "
          >
            Start
          </button>
          <button
            type="button"
            onClick={handleCancelRun}
            disabled={!activeRunId || isBusy}
            className="
              px-3 py-1.5 text-[11px] uppercase tracking-wide rounded-none
              border border-border-subtle text-secondary
              hover:text-primary hover:border-border
              disabled:opacity-60
            "
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRetryRun}
            disabled={!activeRunId || isBusy}
            className="
              px-3 py-1.5 text-[11px] uppercase tracking-wide rounded-none
              border border-border-subtle text-secondary
              hover:text-primary hover:border-border
              disabled:opacity-60
            "
          >
            Retry
          </button>
        </div>
        {errorMessage ? (
          <div className="text-xs text-error">{errorMessage}</div>
        ) : null}
      </div>

      <AgentRunList
        runs={sortedRuns}
        selectedRunId={activeRunId}
        onSelect={setSelectedRunId}
      />

      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <div className="text-[11px] uppercase tracking-wide text-secondary">Events</div>
        {activeRun ? (
          <div className="text-[10px] uppercase tracking-wide text-secondary">
            {activeRun.status}
          </div>
        ) : null}
      </div>

      <AgentEventStream events={events} />
    </div>
  );
}
