import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { PolicyService } from './PolicyService';

type ToolCallEnvelope = {
  callId: string;
  toolId: string;
  requesterId: string;
  runId: string;
  input: unknown;
};

const buildEnvelope = (toolId: string): ToolCallEnvelope => ({
  callId: randomUUID(),
  toolId,
  requesterId: 'agent-host',
  runId: randomUUID(),
  input: { path: './' },
});

describe('PolicyService', () => {
  it('allows tool calls by default', () => {
    const service = new PolicyService();
    const decision = service.evaluateToolCall(buildEnvelope('fs.read'));

    expect(decision.allowed).toBe(true);
  });

  it('denies tool calls on the denylist', () => {
    const service = new PolicyService({ denylist: ['fs.read'] });
    const decision = service.evaluateToolCall(buildEnvelope('fs.read'));

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Tool denied by policy.');
  });

  it('enforces allowlist membership', () => {
    const service = new PolicyService({ allowlist: ['fs.write'] });
    const decision = service.evaluateToolCall(buildEnvelope('fs.read'));

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Tool not in allowlist.');
  });

  it('uses a custom evaluator when provided', () => {
    const service = new PolicyService({
      evaluator: () => ({ allowed: false, reason: 'blocked' }),
    });
    const decision = service.evaluateToolCall(buildEnvelope('fs.read'));

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('blocked');
  });

  it('allows vfs tools by default', () => {
    const service = new PolicyService();
    const vfsTools = ['vfs.ls', 'vfs.read', 'vfs.write', 'vfs.edit', 'vfs.glob', 'vfs.grep'];

    for (const tool of vfsTools) {
      const decision = service.evaluateToolCall(buildEnvelope(tool));
      expect(decision.allowed).toBe(true);
    }
  });

  it('denies vfs tools when on denylist', () => {
    const service = new PolicyService({ denylist: ['vfs.write'] });
    
    expect(service.evaluateToolCall(buildEnvelope('vfs.read')).allowed).toBe(true);
    expect(service.evaluateToolCall(buildEnvelope('vfs.write')).allowed).toBe(false);
  });
});
