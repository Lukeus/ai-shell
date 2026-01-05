import { AgentPolicyConfigSchema, PolicyDecisionSchema, ToolCallEnvelopeSchema } from 'packages-api-contracts';
import type { AgentPolicyConfig, PolicyDecision, ToolCallEnvelope } from 'packages-api-contracts';

export type PolicyEvaluator = (envelope: ToolCallEnvelope) => PolicyDecision;

export type PolicyServiceOptions = {
  allowlist?: string[];
  denylist?: string[];
  evaluator?: PolicyEvaluator;
};

export class PolicyService {
  private readonly allowlist: Set<string> | null;
  private readonly denylist: Set<string>;
  private readonly evaluator?: PolicyEvaluator;

  constructor(options: PolicyServiceOptions = {}) {
    this.allowlist = options.allowlist ? new Set(options.allowlist) : null;
    this.denylist = new Set(options.denylist ?? []);
    this.evaluator = options.evaluator;
  }

  public evaluateToolCall(
    envelope: ToolCallEnvelope,
    runPolicyOverride?: AgentPolicyConfig
  ): PolicyDecision {
    const validated = ToolCallEnvelopeSchema.parse(envelope);

    if (runPolicyOverride) {
      AgentPolicyConfigSchema.parse(runPolicyOverride);
    }

    const evaluatorDecision = this.evaluator
      ? this.parseDecision(this.evaluator(validated))
      : { allowed: true, scope: 'run' as const };

    if (!evaluatorDecision.allowed) {
      return evaluatorDecision;
    }

    if (this.denylist.has(validated.toolId)) {
      return this.parseDecision({
        allowed: false,
        reason: 'Tool denied by policy.',
        scope: 'global',
      });
    }

    const overrideDenylist = new Set(runPolicyOverride?.denylist ?? []);
    if (overrideDenylist.has(validated.toolId)) {
      return this.parseDecision({
        allowed: false,
        reason: 'Tool denied by policy.',
        scope: 'run',
      });
    }

    if (this.allowlist && !this.allowlist.has(validated.toolId)) {
      return this.parseDecision({
        allowed: false,
        reason: 'Tool not in allowlist.',
        scope: 'global',
      });
    }

    const overrideAllowlist = runPolicyOverride?.allowlist
      ? new Set(runPolicyOverride.allowlist)
      : null;
    if (overrideAllowlist && !overrideAllowlist.has(validated.toolId)) {
      return this.parseDecision({
        allowed: false,
        reason: 'Tool not in allowlist.',
        scope: 'run',
      });
    }

    return this.parseDecision({ allowed: true, scope: 'run' });
  }

  private parseDecision(decision: PolicyDecision): PolicyDecision {
    const parsed = PolicyDecisionSchema.safeParse(decision);
    if (parsed.success) {
      return parsed.data;
    }

    return {
      allowed: false,
      reason: 'Policy evaluation failed.',
      scope: 'global',
    };
  }
}
