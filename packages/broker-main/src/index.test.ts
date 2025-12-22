import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { BrokerMain, createVfsToolDefinitions, type AuditLogger } from './index';
import { z } from 'zod';
type ToolCallEnvelope = {
  callId: string;
  toolId: string;
  requesterId: string;
  runId: string;
  input: unknown;
};

describe('BrokerMain with VFS tools', () => {
  let broker: BrokerMain;
  let auditLog: Array<{ runId: string; toolId: string; allowed: boolean }>;

  beforeEach(() => {
    auditLog = [];
    const mockAudit: AuditLogger = {
      logAgentToolAccess: (input) => {
        auditLog.push({ runId: input.runId, toolId: input.toolId, allowed: input.allowed });
      },
    };

    broker = new BrokerMain({ auditLogger: mockAudit });
  });

  it('registers and executes VFS tools', async () => {
    const mockVfs = {
      ls: (_vfsPath: string) => ['file1.txt', 'file2.txt'],
      read: (vfsPath: string) => `content of ${vfsPath}`,
      write: (_vfsPath: string, _content: string) => {
        // no-op for mock
      },
      edit: (_vfsPath: string, _replacements: Array<{ search: string; replace: string }>) => {
        // no-op for mock
      },
      glob: (_pattern: string, mountPath: string) => [`${mountPath}/match.ts`],
      grep: (_pattern: string, mountPath: string) => [
        { file: `${mountPath}/test.ts`, line: 1, text: 'matching line' },
      ],
    };

    const vfsTools = createVfsToolDefinitions(mockVfs);
    for (const tool of vfsTools) {
      broker.registerToolDefinition(tool);
    }

    const runId = randomUUID();

    // Test vfs.ls
    const lsEnvelope: ToolCallEnvelope = {
      callId: randomUUID(),
      toolId: 'vfs.ls',
      requesterId: 'agent-host',
      runId,
      input: { path: '/workspace' },
    };

    const lsResult = await broker.handleAgentToolCall(lsEnvelope);
    expect(lsResult.ok).toBe(true);
    expect(lsResult.output).toEqual(['file1.txt', 'file2.txt']);

    // Test vfs.read
    const readEnvelope: ToolCallEnvelope = {
      callId: randomUUID(),
      toolId: 'vfs.read',
      requesterId: 'agent-host',
      runId,
      input: { path: '/workspace/test.txt' },
    };

    const readResult = await broker.handleAgentToolCall(readEnvelope);
    expect(readResult.ok).toBe(true);
    expect(readResult.output).toEqual({ content: 'content of /workspace/test.txt' });

    // Test vfs.glob
    const globEnvelope: ToolCallEnvelope = {
      callId: randomUUID(),
      toolId: 'vfs.glob',
      requesterId: 'agent-host',
      runId,
      input: { pattern: '*.ts', mountPath: '/workspace' },
    };

    const globResult = await broker.handleAgentToolCall(globEnvelope);
    expect(globResult.ok).toBe(true);
    expect(globResult.output).toEqual(['/workspace/match.ts']);

    // Verify audit logs
    expect(auditLog).toHaveLength(3);
    expect(auditLog.every((log) => log.allowed)).toBe(true);
  });

  it('registers and executes tool definitions', async () => {
    broker.registerToolDefinition({
      id: 'tool.upper',
      description: 'Uppercase',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: (input) => {
        const text = (input as { text: string }).text;
        return { value: text.toUpperCase() };
      },
    });

    const runId = randomUUID();
    const envelope: ToolCallEnvelope = {
      callId: randomUUID(),
      toolId: 'tool.upper',
      requesterId: 'agent-host',
      runId,
      input: { text: 'hello' },
    };

    const result = await broker.handleAgentToolCall(envelope);
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ value: 'HELLO' });
  });

  it('enforces policy on VFS tools', async () => {
    const mockVfs = {
      ls: () => [],
      read: () => '',
      write: () => {},
      edit: () => {},
      glob: () => [],
      grep: () => [],
    };

    const vfsTools = createVfsToolDefinitions(mockVfs);
    for (const tool of vfsTools) {
      broker.registerToolDefinition(tool);
    }

    // Create broker with denylist
    const deniedBroker = new BrokerMain({
      policyService: new (await import('./policy/PolicyService')).PolicyService({
        denylist: ['vfs.write'],
      }),
      auditLogger: {
        logAgentToolAccess: (input) => {
          auditLog.push({ runId: input.runId, toolId: input.toolId, allowed: input.allowed });
        },
      },
    });

    for (const tool of vfsTools) {
      deniedBroker.registerToolDefinition(tool);
    }

    const runId = randomUUID();
    const writeEnvelope: ToolCallEnvelope = {
      callId: randomUUID(),
      toolId: 'vfs.write',
      requesterId: 'agent-host',
      runId,
      input: { path: '/workspace/new.txt', content: 'data' },
    };

    const result = await deniedBroker.handleAgentToolCall(writeEnvelope);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('POLICY_DENIED');

    // Verify audit logged the denial
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].allowed).toBe(false);
  });
});
