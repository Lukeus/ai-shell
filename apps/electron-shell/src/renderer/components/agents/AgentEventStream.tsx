import type { AgentEvent } from 'packages-api-contracts';

type AgentEventStreamProps = {
  events: AgentEvent[];
};

const formatEvent = (event: AgentEvent): string => {
  switch (event.type) {
    case 'status':
      return `Status: ${event.status}`;
    case 'plan-step':
      return `Step: ${event.title} (${event.status})`;
    case 'plan':
      return `Plan updated (${event.steps.length} steps)`;
    case 'todo-update':
      return `Todo: ${event.title} (${event.status})`;
    case 'tool-call':
      return `Tool call: ${event.toolCall.toolId}`;
    case 'tool-result':
      return `Tool result: ${event.result.toolId} (${event.result.ok ? 'ok' : 'error'})`;
    case 'log':
      return `${event.level.toUpperCase()}: ${event.message}`;
    case 'error':
      return `Error: ${event.message}`;
    case 'draft':
      return `Draft ready: ${event.draft.featureId}`;
    default:
      return 'Unknown event';
  }
};

export function AgentEventStream({ events }: AgentEventStreamProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {events.length === 0 ? (
        <div className="text-[13px] text-secondary">No events yet.</div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className="rounded-none border border-border-subtle bg-surface px-4 py-3"
          >
            <div className="text-[10px] uppercase tracking-wide text-secondary">
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
            <div className="text-[13px] text-primary">{formatEvent(event)}</div>
          </div>
        ))
      )}
    </div>
  );
}
