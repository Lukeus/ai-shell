import { describe, it, expect, vi } from 'vitest';
import { createAgentHostRunOrchestrator } from './run-orchestration';

describe('createAgentHostRunOrchestrator', () => {
  it('strips skillId before forwarding start-run requests to agent host', () => {
    const brokerMain = {
      setRunPolicy: vi.fn(),
    } as any;
    const sendMessage = vi.fn();
    const orchestrator = createAgentHostRunOrchestrator({
      brokerMain,
      sendMessage,
    });

    orchestrator.startRun('123e4567-e89b-12d3-a456-426614174000', {
      goal: 'Do the thing',
      skillId: 'analysis-skill',
      config: {
        policy: {
          denylist: ['repo.search'],
        },
      },
    });

    expect(brokerMain.setRunPolicy).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      {
        denylist: ['repo.search'],
      }
    );

    const message = sendMessage.mock.calls[0]?.[0];
    expect(message.type).toBe('agent-host:start-run');
    expect(message.request.skillId).toBeUndefined();
    expect(message.request.goal).toBe('Do the thing');
  });
});
