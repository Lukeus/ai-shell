import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { AgentHostManager } from './agent-host-manager';
import { BrokerMain } from 'packages-broker-main';
import { fork } from 'child_process';
import { fsBrokerService } from './FsBrokerService';
import { workspaceService } from './WorkspaceService';
import { sddTraceService } from './SddTraceService';
import { resolvePathWithinWorkspace } from './workspace-paths';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\temp'),
  },
}));

vi.mock('child_process', () => {
  const fork = vi.fn(() => {
    const emitter = new EventEmitter() as EventEmitter & {
      send: (message: unknown) => void;
      kill: (signal?: string) => void;
      killed: boolean;
    };
    emitter.send = vi.fn();
    emitter.kill = vi.fn();
    emitter.killed = false;
    return emitter;
  });
  const spawn = vi.fn();

  return {
    fork,
    spawn,
    default: {
      fork,
      spawn,
    },
  };
});

vi.mock('packages-broker-main', () => {
  class BrokerMain {
    static lastInstance: BrokerMain | null = null;
    public tools: Array<{ id: string; execute?: (input: unknown) => unknown }> = [];
    constructor() {
      BrokerMain.lastInstance = this;
    }
    registerToolDefinition(tool: { id: string; execute?: (input: unknown) => unknown }) {
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

vi.mock('./FsBrokerService', () => ({
  fsBrokerService: {
    createFile: vi.fn(),
  },
}));

vi.mock('./WorkspaceService', () => ({
  workspaceService: {
    getWorkspace: vi.fn(),
  },
}));

vi.mock('./SddTraceService', () => ({
  sddTraceService: {
    recordFileChange: vi.fn(),
  },
}));

vi.mock('./workspace-paths', () => ({
  resolvePathWithinWorkspace: vi.fn(),
}));

describe('AgentHostManager built-in tools', () => {
  let originalEnv: NodeJS.ProcessEnv;

  const restoreProcessEnv = (env: NodeJS.ProcessEnv) => {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, env);
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
        'repo.list',
        'model.generate',
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

    expect(tools).toHaveLength(6);
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

  it('records SDD metadata for workspace.write', async () => {
    const manager = new AgentHostManager({ agentHostPath: 'fake-agent-host' });
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: 'C:\\workspace',
      name: 'workspace',
    });
    vi.mocked(resolvePathWithinWorkspace).mockResolvedValue('C:\\workspace\\file.txt');
    const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({
      isFile: () => true,
    } as fs.Stats);
    const readSpy = vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('before'));
    vi.mocked(fsBrokerService.createFile).mockResolvedValue(undefined);

    await manager.start();

    const broker = BrokerMain as unknown as {
      lastInstance: { tools: Array<{ id: string; execute?: (input: unknown) => unknown }> } | null;
    };
    const tool = broker.lastInstance?.tools.find((item) => item.id === 'workspace.write');
    expect(tool?.execute).toBeDefined();

    await tool?.execute?.({ path: 'file.txt', content: 'after' });

    const beforeHash = createHash('sha256').update('before').digest('hex');
    const afterHash = createHash('sha256').update('after', 'utf8').digest('hex');

    expect(fsBrokerService.createFile).toHaveBeenCalledWith('file.txt', 'after');
    expect(sddTraceService.recordFileChange).toHaveBeenCalledWith({
      path: 'C:\\workspace\\file.txt',
      op: 'modified',
      actor: 'agent',
      hashBefore: beforeHash,
      hashAfter: afterHash,
    });

    statSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('records SDD metadata for workspace.update on new files', async () => {
    const manager = new AgentHostManager({ agentHostPath: 'fake-agent-host' });
    vi.mocked(workspaceService.getWorkspace).mockReturnValue({
      path: 'C:\\workspace',
      name: 'workspace',
    });
    vi.mocked(resolvePathWithinWorkspace).mockResolvedValue('C:\\workspace\\new.txt');
    const statSpy = vi
      .spyOn(fs.promises, 'stat')
      .mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    vi.mocked(fsBrokerService.createFile).mockResolvedValue(undefined);

    await manager.start();

    const broker = BrokerMain as unknown as {
      lastInstance: { tools: Array<{ id: string; execute?: (input: unknown) => unknown }> } | null;
    };
    const tool = broker.lastInstance?.tools.find((item) => item.id === 'workspace.update');
    expect(tool?.execute).toBeDefined();

    await tool?.execute?.({ path: 'new.txt', content: 'content' });

    const afterHash = createHash('sha256').update('content', 'utf8').digest('hex');

    expect(fsBrokerService.createFile).toHaveBeenCalledWith('new.txt', 'content');
    expect(sddTraceService.recordFileChange).toHaveBeenCalledWith({
      path: 'C:\\workspace\\new.txt',
      op: 'added',
      actor: 'agent',
      hashBefore: undefined,
      hashAfter: afterHash,
    });

    statSpy.mockRestore();
  });
});
