import type { AgentEvent } from 'packages-api-contracts';

type AgentPlanTodosProps = {
  events: AgentEvent[];
};

type PlanStep = {
  stepId: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  timestamp: string;
};

const extractPlanSteps = (events: AgentEvent[]): PlanStep[] => {
  const stepMap = new Map<string, PlanStep>();

  for (const event of events) {
    if (event.type === 'plan-step') {
      stepMap.set(event.stepId, {
        stepId: event.stepId,
        title: event.title,
        status: event.status,
        timestamp: event.timestamp,
      });
    }
  }

  return Array.from(stepMap.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

const getStatusColor = (status: PlanStep['status']): string => {
  switch (status) {
    case 'running':
      return 'text-accent';
    case 'completed':
      return 'text-success';
    case 'failed':
      return 'text-error';
    case 'skipped':
      return 'text-secondary';
    default:
      return 'text-secondary';
  }
};

const getStatusIcon = (status: PlanStep['status']): string => {
  switch (status) {
    case 'running':
      return '●';
    case 'completed':
      return '✓';
    case 'failed':
      return '✗';
    case 'skipped':
      return '—';
    default:
      return '○';
  }
};

export function AgentPlanTodos({ events }: AgentPlanTodosProps) {
  const planSteps = extractPlanSteps(events);

  if (planSteps.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border-subtle">
      <div className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-secondary">
        Plan & Todos
      </div>
      <div className="max-h-64 overflow-y-auto px-4 pb-3 space-y-2">
        {planSteps.map((step) => (
          <div
            key={step.stepId}
            className="flex items-start gap-3 rounded-none border border-border-subtle bg-surface px-3 py-2"
          >
            <span className={`text-[14px] ${getStatusColor(step.status)} mt-0.5`}>
              {getStatusIcon(step.status)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-primary">{step.title}</div>
              <div className="text-[10px] uppercase tracking-wide text-secondary mt-1">
                {step.status.replace('-', ' ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
