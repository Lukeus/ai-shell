import type { AgentRunMetadata } from 'packages-api-contracts';

type AgentRunListProps = {
  runs: AgentRunMetadata[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
};

const formatStatus = (status: AgentRunMetadata['status']) =>
  status.replace('-', ' ');

const formatRunId = (runId: string) => runId.slice(0, 8);

export function AgentRunList({ runs, selectedRunId, onSelect }: AgentRunListProps) {
  if (runs.length === 0) {
    return (
      <div className="px-4 py-3 text-[13px] text-secondary border-b border-border-subtle">
        No agent runs yet.
      </div>
    );
  }

  return (
    <div className="border-b border-border-subtle">
      <div className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-secondary">
        Recent Runs
      </div>
      <div className="max-h-48 overflow-y-auto">
        {runs.map((run) => {
          const isActive = run.id === selectedRunId;
          return (
            <button
              key={run.id}
              type="button"
              onClick={() => onSelect(run.id)}
              className={`
                w-full flex items-center justify-between px-4 py-2.5 text-left text-[13px]
                transition-colors duration-150
                ${isActive ? 'bg-surface-hover text-primary' : 'text-secondary hover:text-primary hover:bg-surface'}
              `}
            >
              <div className="flex flex-col">
                <span className="font-medium text-[12px]">Run {formatRunId(run.id)}</span>
                <span className="text-[10px] uppercase tracking-wide text-secondary">
                  {formatStatus(run.status)} · {run.source}
                </span>
              </div>
              <span className="text-[10px] text-secondary">
                {new Date(run.updatedAt).toLocaleTimeString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
