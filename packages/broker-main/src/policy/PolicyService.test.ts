import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import type { ToolCallEnvelope } from 'packages-api-contracts';
import { PolicyService } from './PolicyService';

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
});
