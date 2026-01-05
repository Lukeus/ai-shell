import { useEffect } from 'react';
import type { AgentEvent } from 'packages-api-contracts';

type UseAgentEventStreamOptions = {
  runId: string | null;
  onEvent: (event: AgentEvent) => void;
};

export function useAgentEventStream({ runId, onEvent }: UseAgentEventStreamOptions): void {
  useEffect(() => {
    if (!runId) {
      return;
    }

    let isActive = true;
    void window.api.agents.subscribeEvents({ runId });
    const unsubscribe = window.api.agents.onEvent((event) => {
      if (isActive) {
        onEvent(event);
      }
    });

    return () => {
      isActive = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      void window.api.agents.unsubscribeEvents({ runId });
    };
  }, [onEvent, runId]);
}
