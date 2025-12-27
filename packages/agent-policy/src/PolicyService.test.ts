import { describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { PolicyService } from './PolicyService';
import type { ToolCallEnvelope } from 'packages-api-contracts';

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
      evaluator: () => ({ allowed: false, reason: 'blocked', scope: 'global' }),
    });
    const decision = service.evaluateToolCall(buildEnvelope('fs.read'));

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('blocked');
  });

  it('applies per-run denylist overrides', () => {
    const service = new PolicyService();
    const decision = service.evaluateToolCall(buildEnvelope('fs.read'), {
      denylist: ['fs.read'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.scope).toBe('run');
  });

  it('applies per-run allowlist overrides without widening globals', () => {
    const service = new PolicyService({ allowlist: ['fs.read'] });

    expect(
      service.evaluateToolCall(buildEnvelope('fs.read'), { allowlist: ['fs.write'] }).allowed
    ).toBe(false);

    expect(
      service.evaluateToolCall(buildEnvelope('fs.write'), { allowlist: ['fs.write'] }).allowed
    ).toBe(false);
  });
});
