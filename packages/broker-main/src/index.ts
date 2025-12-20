import {
  JsonValueSchema,
  ToolCallEnvelopeSchema,
  ToolCallResultSchema,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { PolicyService } from './policy/PolicyService';

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
  private readonly toolHandlers = new Map<string, ToolHandler>();

  constructor(options: BrokerMainOptions = {}) {
    this.policyService = options.policyService ?? new PolicyService();
    this.auditLogger = options.auditLogger;
  }

  public registerTool(toolId: string, handler: ToolHandler): void {
    this.toolHandlers.set(toolId, handler);
  }

  public unregisterTool(toolId: string): void {
    this.toolHandlers.delete(toolId);
  }

  public listTools(): string[] {
    return Array.from(this.toolHandlers.keys());
  }

  public async handleAgentToolCall(envelope: ToolCallEnvelope): Promise<ToolCallResult> {
    const validated = ToolCallEnvelopeSchema.parse(envelope);
    const decision = this.policyService.evaluateToolCall(validated);

    this.auditLogger?.logAgentToolAccess({
      runId: validated.runId,
      toolId: validated.toolId,
      requesterId: validated.requesterId,
      allowed: decision.allowed,
      reason: decision.reason,
    });

    if (!decision.allowed) {
      return this.buildErrorResult(validated, TOOL_ERROR_CODES.POLICY_DENIED, 0);
    }

    const handler = this.toolHandlers.get(validated.toolId);
    if (!handler) {
      return this.buildErrorResult(validated, TOOL_ERROR_CODES.TOOL_NOT_FOUND, 0);
    }

    const startedAt = Date.now();

    try {
      const output = await handler(validated.input, validated);
      const result: ToolCallResult = {
        callId: validated.callId,
        toolId: validated.toolId,
        runId: validated.runId,
        ok: true,
        durationMs: this.elapsedMs(startedAt),
      };

      if (output !== undefined) {
        const outputParsed = JsonValueSchema.safeParse(output);
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
    durationMs: number
  ): ToolCallResult {
    const result: ToolCallResult = {
      callId: envelope.callId,
      toolId: envelope.toolId,
      runId: envelope.runId,
      ok: false,
      error,
      durationMs,
    };

    return ToolCallResultSchema.parse(result);
  }

  private elapsedMs(startedAt: number): number {
    const elapsed = Date.now() - startedAt;
    return elapsed < 0 ? 0 : Math.round(elapsed);
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
  return {
    'vfs.ls': (input: JsonValue) => {
      const { path } = input as { path: string };
      return vfs.ls(path);
    },
    'vfs.read': (input: JsonValue) => {
      const { path } = input as { path: string };
      return { content: vfs.read(path) };
    },
    'vfs.write': (input: JsonValue) => {
      const { path, content } = input as { path: string; content: string };
      vfs.write(path, content);
      return { success: true };
    },
    'vfs.edit': (input: JsonValue) => {
      const { path, replacements } = input as {
        path: string;
        replacements: Array<{ search: string; replace: string }>;
      };
      vfs.edit(path, replacements);
      return { success: true };
    },
    'vfs.glob': (input: JsonValue) => {
      const { pattern, mountPath } = input as { pattern: string; mountPath: string };
      return vfs.glob(pattern, mountPath);
    },
    'vfs.grep': (input: JsonValue) => {
      const { pattern, mountPath } = input as { pattern: string; mountPath: string };
      return vfs.grep(pattern, mountPath);
    },
  };
}
