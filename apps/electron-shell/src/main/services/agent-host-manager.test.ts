import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { AgentHostManager } from './agent-host-manager';
import { BrokerMain } from 'packages-broker-main';
import { fork } from 'child_process';

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
  let originalEnv: NodeJS.ProcessEnv;

  const restoreProcessEnv = (env: NodeJS.ProcessEnv) => {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, env);
  };

  beforeEach(() => {
    originalEnv = { ...process.env };
    const broker = BrokerMain as unknown as {
      lastInstance: { tools: Array<{ id: string }> } | null;
    };
    if (broker.lastInstance) {
      broker.lastInstance.tools = [];
    }

    process.env.NODE_ENV = 'test';
    process.env.PATH = '/mock/bin';
    process.env.SECRET_TOKEN = 'shh';
  });

  afterEach(() => {
    restoreProcessEnv(originalEnv);
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

  it('should allowlist environment variables for child process', async () => {
    const manager = new AgentHostManager({ agentHostPath: 'fake-agent-host' });
    await manager.start();

    const env = vi.mocked(fork).mock.calls[0]?.[2]?.env as Record<string, string> | undefined;
    expect(env).toBeDefined();
    expect(env?.SECRET_TOKEN).toBeUndefined();
    expect(env?.PATH ?? env?.Path).toBe('/mock/bin');
    expect(env?.NODE_ENV).toBe('test');
  });
});
