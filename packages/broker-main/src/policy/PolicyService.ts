const {
  PolicyDecisionSchema,
  ToolCallEnvelopeSchema,
} = require('packages-api-contracts');

type PolicyDecision = {
  allowed: boolean;
  reason?: string;
  scope: 'global' | 'run';
};
type ToolCallEnvelope = {
  callId: string;
  toolId: string;
  requesterId: string;
  runId: string;
  input: unknown;
  reason?: string;
};

type PolicyEvaluator = (envelope: ToolCallEnvelope) => PolicyDecision;

type PolicyServiceOptions = {
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

  public evaluateToolCall(envelope: ToolCallEnvelope): PolicyDecision {
    const validated = ToolCallEnvelopeSchema.parse(envelope);

    if (this.evaluator) {
      return this.parseDecision(this.evaluator(validated));
    }

    if (this.denylist.has(validated.toolId)) {
      return this.parseDecision({
        allowed: false,
        reason: 'Tool denied by policy.',
        scope: 'global',
      });
    }

    if (this.allowlist && !this.allowlist.has(validated.toolId)) {
      return this.parseDecision({
        allowed: false,
        reason: 'Tool not in allowlist.',
        scope: 'global',
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
