import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { AgentHostManager } from './agent-host-manager';
import { BrokerMain } from 'packages-broker-main';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\temp'),
  },
}));

vi.mock('child_process', () => ({
  fork: vi.fn(() => {
    const emitter = new EventEmitter() as EventEmitter & {
      send: (message: unknown) => void;
      kill: (signal?: string) => void;
      killed: boolean;
    };
    emitter.send = vi.fn();
    emitter.kill = vi.fn();
    emitter.killed = false;
    return emitter;
  }),
  spawn: vi.fn(),
}));

vi.mock('packages-broker-main', () => {
  class BrokerMain {
    static lastInstance: BrokerMain | null = null;
    public tools: Array<{ id: string }> = [];
    constructor() {
      BrokerMain.lastInstance = this;
    }
    registerToolDefinition(tool: { id: string }) {
      if (!this.tools.find((t) => t.id === tool.id)) {
        this.tools.push(tool);
      }
    }
    listTools(): string[] {
      return this.tools.map((tool) => tool.id);
    }
    handleAgentToolCall() {
      return Promise.resolve({ ok: false });
    }
  }
  return { BrokerMain };
});

describe('AgentHostManager built-in tools', () => {
  beforeEach(() => {
    const broker = BrokerMain as unknown as {
      lastInstance: { tools: Array<{ id: string }> } | null;
    };
    if (broker.lastInstance) {
      broker.lastInstance.tools = [];
    }
  });

  it('registers built-in tools on start', async () => {
    const manager = new AgentHostManager({ agentHostPath: 'fake-agent-host' });
    await manager.start();

    const broker = BrokerMain as unknown as {
      lastInstance: { tools: Array<{ id: string }> } | null;
    };
    const tools = broker.lastInstance?.tools.map((tool) => tool.id) ?? [];

    expect(tools).toEqual(
      expect.arrayContaining([
        'workspace.read',
        'workspace.write',
        'workspace.update',
        'repo.search',
      ])
    );
  });

  it('does not register built-in tools more than once', async () => {
    const manager = new AgentHostManager({ agentHostPath: 'fake-agent-host' });
    await manager.start();
    await manager.start();

    const broker = BrokerMain as unknown as {
      lastInstance: { tools: Array<{ id: string }> } | null;
    };
    const tools = broker.lastInstance?.tools.map((tool) => tool.id) ?? [];

    expect(tools).toHaveLength(4);
  });
});
