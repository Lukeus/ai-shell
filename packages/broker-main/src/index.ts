import {
  AgentPolicyConfigSchema,
  JsonValueSchema,
  ToolCallEnvelopeSchema,
  ToolCallResultSchema,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { ToolExecutor, ToolRegistry, type ToolDefinition } from 'packages-agent-tools';
import { PolicyService } from './policy/PolicyService';
import type { AgentPolicyConfig } from 'packages-api-contracts';

export const TOOL_ERROR_CODES = {
  POLICY_DENIED: 'POLICY_DENIED',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  INVALID_TOOL_OUTPUT: 'INVALID_TOOL_OUTPUT',
} as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[keyof typeof TOOL_ERROR_CODES];

export type ToolHandler = (
  input: JsonValue,
  envelope: ToolCallEnvelope
) => Promise<JsonValue> | JsonValue;

export type AuditLogger = {
  logAgentToolAccess: (input: {
    runId: string;
    toolId: string;
    requesterId: string;
    allowed: boolean;
    reason?: string;
  }) => void;
};

type BrokerMainOptions = {
  policyService?: PolicyService;
  auditLogger?: AuditLogger;
};

export class BrokerMain {
  private readonly policyService: PolicyService;
  private readonly auditLogger?: AuditLogger;
  private readonly registry: ToolRegistry;
  private readonly executor: ToolExecutor;
  private readonly runPolicyOverrides = new Map<string, AgentPolicyConfig>();

  constructor(options: BrokerMainOptions = {}) {
    this.policyService = options.policyService ?? new PolicyService();
    this.auditLogger = options.auditLogger;
    this.registry = new ToolRegistry();
    this.executor = new ToolExecutor(this.registry);
  }

  public registerTool(toolId: string, handler: ToolHandler): void {
    const tool: ToolDefinition = {
      id: toolId,
      description: toolId,
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      execute: (input, context) => {
        const envelope = context?.envelope as ToolCallEnvelope | undefined;
        if (!envelope) {
          throw new Error('Missing tool execution envelope.');
        }
        return handler(input as JsonValue, envelope);
      },
    };
    this.registry.register(tool);
  }

  public registerToolDefinition(tool: ToolDefinition): void {
    this.registry.register(tool);
  }

  public unregisterTool(toolId: string): void {
    this.registry.unregister(toolId);
  }

  public listTools(): string[] {
    return this.registry.list().map((tool) => tool.id);
  }

  public setRunPolicy(runId: string, policy?: AgentPolicyConfig | null): void {
    if (!policy) {
      this.runPolicyOverrides.delete(runId);
      return;
    }

    const parsed = AgentPolicyConfigSchema.parse(policy);
    const hasAllowlist = Array.isArray(parsed.allowlist) && parsed.allowlist.length > 0;
    const hasDenylist = Array.isArray(parsed.denylist) && parsed.denylist.length > 0;
    if (!hasAllowlist && !hasDenylist) {
      this.runPolicyOverrides.delete(runId);
      return;
    }

    this.runPolicyOverrides.set(runId, parsed);
  }

  public clearRunPolicy(runId: string): void {
    this.runPolicyOverrides.delete(runId);
  }

  public async handleAgentToolCall(envelope: ToolCallEnvelope): Promise<ToolCallResult> {
    const validated = ToolCallEnvelopeSchema.parse(envelope);
    const runPolicy = this.runPolicyOverrides.get(validated.runId);
    const mergedPolicyOverride = this.mergePolicyOverrides(runPolicy, validated.policyOverride);
    const decision = this.policyService.evaluateToolCall(validated, mergedPolicyOverride);

    this.auditLogger?.logAgentToolAccess({
      runId: validated.runId,
      toolId: validated.toolId,
      requesterId: validated.requesterId,
      allowed: decision.allowed,
      reason: decision.reason,
    });

    if (!decision.allowed) {
      return this.buildErrorResult(
        validated,
        TOOL_ERROR_CODES.POLICY_DENIED,
        0,
        decision.reason
      );
    }

    const startedAt = Date.now();

    try {
      const execResult = await this.executor.execute(validated.toolId, validated.input, {
        envelope: validated,
      });

      if (!execResult.ok) {
        const error = execResult.error ?? 'Tool execution failed';
        if (error.startsWith('Tool not found:')) {
          return this.buildErrorResult(
            validated,
            TOOL_ERROR_CODES.TOOL_NOT_FOUND,
            this.elapsedMs(startedAt)
          );
        }
        if (error.startsWith('Invalid tool output')) {
          return this.buildErrorResult(
            validated,
            TOOL_ERROR_CODES.INVALID_TOOL_OUTPUT,
            this.elapsedMs(startedAt)
          );
        }
        return this.buildErrorResult(
          validated,
          TOOL_ERROR_CODES.TOOL_EXECUTION_FAILED,
          this.elapsedMs(startedAt)
        );
      }

      const result: ToolCallResult = {
        callId: validated.callId,
        toolId: validated.toolId,
        runId: validated.runId,
        ok: true,
        durationMs: this.elapsedMs(startedAt),
      };

      if (execResult.output !== undefined) {
        const outputParsed = JsonValueSchema.safeParse(execResult.output);
        if (!outputParsed.success) {
          return this.buildErrorResult(
            validated,
            TOOL_ERROR_CODES.INVALID_TOOL_OUTPUT,
            this.elapsedMs(startedAt)
          );
        }
        result.output = outputParsed.data;
      }

      return ToolCallResultSchema.parse(result);
    } catch {
      return this.buildErrorResult(
        validated,
        TOOL_ERROR_CODES.TOOL_EXECUTION_FAILED,
        this.elapsedMs(startedAt)
      );
    }
  }

  private buildErrorResult(
    envelope: ToolCallEnvelope,
    error: ToolErrorCode,
    durationMs: number,
    reason?: string
  ): ToolCallResult {
    const result: ToolCallResult = {
      callId: envelope.callId,
      toolId: envelope.toolId,
      runId: envelope.runId,
      ok: false,
      error,
      durationMs,
    };

    if (error === TOOL_ERROR_CODES.POLICY_DENIED) {
      result.output = {
        denied: true,
        ...(reason ? { reason } : {}),
      };
    }

    return ToolCallResultSchema.parse(result);
  }

  private elapsedMs(startedAt: number): number {
    const elapsed = Date.now() - startedAt;
    return elapsed < 0 ? 0 : Math.round(elapsed);
  }

  private mergePolicyOverrides(
    runPolicy?: AgentPolicyConfig,
    callPolicy?: AgentPolicyConfig | null
  ): AgentPolicyConfig | undefined {
    if (!runPolicy && !callPolicy) {
      return undefined;
    }

    const run = runPolicy ? AgentPolicyConfigSchema.parse(runPolicy) : null;
    const call = callPolicy ? AgentPolicyConfigSchema.parse(callPolicy) : null;

    const denylist = [
      ...(run?.denylist ?? []),
      ...(call?.denylist ?? []),
    ];

    const runAllow = run?.allowlist ?? null;
    const callAllow = call?.allowlist ?? null;
    const allowlist =
      runAllow && callAllow
        ? runAllow.filter((toolId) => callAllow.includes(toolId))
        : runAllow ?? callAllow;

    const merged: AgentPolicyConfig = {
      ...(allowlist ? { allowlist } : {}),
      ...(denylist.length > 0 ? { denylist } : {}),
    };

    return AgentPolicyConfigSchema.parse(merged);
  }
}

export const brokerMain = new BrokerMain();
export { PolicyService };

/**
 * VFS tool handler factory.
 * Returns tool handlers that operate on a VirtualFS instance.
 */
export function createVfsToolHandlers(vfs: {
  ls: (vfsPath: string) => string[];
  read: (vfsPath: string) => string;
  write: (vfsPath: string, content: string) => void;
  edit: (vfsPath: string, replacements: Array<{ search: string; replace: string }>) => void;
  glob: (pattern: string, mountPath: string) => string[];
  grep: (pattern: string, mountPath: string) => Array<{ file: string; line: number; text: string }>;
}): Record<string, ToolHandler> {
  return Object.fromEntries(
    createVfsToolDefinitions(vfs).map((tool) => [
      tool.id,
      (input: JsonValue) => tool.execute(input) as JsonValue,
    ])
  );
}

export function createVfsToolDefinitions(vfs: {
  ls: (vfsPath: string) => string[];
  read: (vfsPath: string) => string;
  write: (vfsPath: string, content: string) => void;
  edit: (vfsPath: string, replacements: Array<{ search: string; replace: string }>) => void;
  glob: (pattern: string, mountPath: string) => string[];
  grep: (pattern: string, mountPath: string) => Array<{ file: string; line: number; text: string }>;
}): ToolDefinition[] {
  return [
    {
      id: 'vfs.ls',
      description: 'List virtual filesystem entries.',
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      category: 'fs',
      execute: (input: unknown) => {
        const { path } = input as { path: string };
        return vfs.ls(path);
      },
    },
    {
      id: 'vfs.read',
      description: 'Read a virtual filesystem file.',
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      category: 'fs',
      execute: (input: unknown) => {
        const { path } = input as { path: string };
        return { content: vfs.read(path) };
      },
    },
    {
      id: 'vfs.write',
      description: 'Write a virtual filesystem file.',
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      category: 'fs',
      execute: (input: unknown) => {
        const { path, content } = input as { path: string; content: string };
        vfs.write(path, content);
        return { success: true };
      },
    },
    {
      id: 'vfs.edit',
      description: 'Edit a virtual filesystem file.',
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      category: 'fs',
      execute: (input: unknown) => {
        const { path, replacements } = input as {
          path: string;
          replacements: Array<{ search: string; replace: string }>;
        };
        vfs.edit(path, replacements);
        return { success: true };
      },
    },
    {
      id: 'vfs.glob',
      description: 'Glob virtual filesystem paths.',
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      category: 'fs',
      execute: (input: unknown) => {
        const { pattern, mountPath } = input as { pattern: string; mountPath: string };
        return vfs.glob(pattern, mountPath);
      },
    },
    {
      id: 'vfs.grep',
      description: 'Grep virtual filesystem paths.',
      inputSchema: JsonValueSchema,
      outputSchema: JsonValueSchema,
      category: 'fs',
      execute: (input: unknown) => {
        const { pattern, mountPath } = input as { pattern: string; mountPath: string };
        return vfs.grep(pattern, mountPath);
      },
    },
  ];
}
