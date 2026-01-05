import { randomUUID } from 'crypto';
import {
  AgentEventSchema,
  AgentRunStartRequestSchema,
  JsonValueSchema,
  ToolCallEnvelopeSchema,
  type AgentEvent,
  type AgentPlanStepStatus,
  type AgentRunStartRequest,
  type AgentRunStatus,
  type AgentPolicyConfig,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { AgentMemoryStore } from 'packages-agent-memory';
import { createDeepAgent, type BackendProtocol, type CreateDeepAgentParams } from 'deepagents';
import { HumanMessage } from '@langchain/core/messages';
import {
  BaseLanguageModel,
  type BaseLanguageModelCallOptions,
  type BaseLanguageModelInput,
} from '@langchain/core/language_models/base';
import type { BasePromptValueInterface } from '@langchain/core/prompt_values';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import type { LLMResult } from '@langchain/core/outputs';
import { tool } from '@langchain/core/tools';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';

export type ToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type AgentRunnerOptions = {
  toolExecutor: ToolExecutor;
  onEvent: (event: AgentEvent) => void;
  createAgent?: (params?: CreateDeepAgentParams) => ReturnType<typeof createDeepAgent>;
  now?: () => string;
  idProvider?: () => string;
};

type TodoStatus = 'pending' | 'in_progress' | 'completed';

type TodoItem = {
  content: string;
  status: TodoStatus;
};

type RunContext = {
  runId: string;
  abortController: AbortController;
  memoryStore: AgentMemoryStore;
  allowlist?: Set<string>;
  policyOverride?: AgentPolicyConfig;
  todoMap: Map<string, string>;
  canceledReason?: string;
};

const RESERVED_TOOL_IDS = new Set([
  'workspace.read',
  'workspace.write',
  'workspace.update',
  'repo.search',
  'repo.list',
  'model.generate',
]);

const TODO_STATUS_MAP: Record<TodoStatus, AgentPlanStepStatus> = {
  pending: 'pending',
  in_progress: 'running',
  completed: 'completed',
};

type BrokeredModelOptions = {
  executeModelCall: (payload: JsonValue) => Promise<ToolCallResult>;
  connectionId?: string;
  modelRef?: string;
  onLog?: (output: string) => void;
};

class BrokeredModel extends BaseLanguageModel<string> {
  lc_namespace = ['ai-shell', 'brokered-model'];
  private readonly executeModelCall: BrokeredModelOptions['executeModelCall'];
  private readonly connectionId?: string;
  private readonly modelRef?: string;
  private readonly onLog?: (output: string) => void;

  constructor(options: BrokeredModelOptions) {
    super({});
    this.executeModelCall = options.executeModelCall;
    this.connectionId = options.connectionId;
    this.modelRef = options.modelRef;
    this.onLog = options.onLog;
  }

  _modelType(): string {
    return 'brokered';
  }

  _llmType(): string {
    return 'brokered';
  }

  async invoke(
    input: BaseLanguageModelInput,
    options?: Partial<BaseLanguageModelCallOptions>
  ): Promise<string> {
    const promptValue = BrokeredModel._convertInputToPromptValue(input);
    const result = await this.generatePrompt([promptValue], options);
    const text = result.generations?.[0]?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('BrokeredModel returned invalid output.');
    }
    return text;
  }

  async generatePrompt(
    promptValues: BasePromptValueInterface[],
    _options?: string[] | BaseLanguageModelCallOptions,
    _callbacks?: Callbacks
  ): Promise<LLMResult> {
    const { prompt, systemPrompt } = this.buildPrompt(promptValues);
    const inputPayload: Record<string, JsonValue> = {
      prompt,
    };

    if (systemPrompt) {
      inputPayload.systemPrompt = systemPrompt;
    }
    if (this.connectionId) {
      inputPayload.connectionId = this.connectionId;
    }
    if (this.modelRef) {
      inputPayload.modelRef = this.modelRef;
    }

    const result = await this.executeModelCall(inputPayload as JsonValue);
    const output = result.output as { text?: unknown } | undefined;
    if (!output || typeof output.text !== 'string') {
      throw new Error('model.generate returned invalid output');
    }

    this.onLog?.(output.text);

    return {
      generations: [[{ text: output.text }]],
    };
  }

  private buildPrompt(
    promptValues: BasePromptValueInterface[]
  ): { prompt: string; systemPrompt?: string } {
    const messages = promptValues.flatMap((value) => value.toChatMessages());
    const systemParts: string[] = [];
    const promptParts: string[] = [];

    for (const message of messages) {
      const text = message.text?.trim();
      if (!text) {
        continue;
      }
      if (message.type === 'system') {
        systemParts.push(text);
      } else {
        promptParts.push(text);
      }
    }

    const prompt = promptParts.join('\n\n').trim();
    const systemPrompt = systemParts.join('\n\n').trim();

    return {
      prompt: prompt.length > 0 ? prompt : 'Continue.',
      systemPrompt: systemPrompt.length > 0 ? systemPrompt : undefined,
    };
  }
}

export class DeepAgentRunner {
  private readonly toolExecutor: ToolExecutor;
  private readonly onEvent: (event: AgentEvent) => void;
  private readonly createAgent: NonNullable<AgentRunnerOptions['createAgent']>;
  private readonly now: () => string;
  private readonly idProvider: () => string;
  private readonly activeRuns = new Map<string, RunContext>();

  constructor(options: AgentRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
    this.createAgent = options.createAgent ?? createDeepAgent;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idProvider = options.idProvider ?? randomUUID;
  }

  public cancelRun(runId: string, reason?: string): void {
    const runContext = this.activeRuns.get(runId);
    if (!runContext) {
      return;
    }
    runContext.canceledReason = reason;
    runContext.abortController.abort();
  }

  public async startRun(
    runId: string,
    request: AgentRunStartRequest,
    toolCalls: ToolCallEnvelope[] = []
  ): Promise<void> {
    AgentRunStartRequestSchema.parse(request);
    const runContext = this.createRunContext(runId, request);

    this.emitStatus(runContext, 'running');

    const timeoutMs = request.config?.budgets?.maxWallclockMs;
    const timeoutId = this.maybeScheduleTimeout(runId, timeoutMs);

    try {
      if (toolCalls.length > 0) {
        await this.runToolCalls(runContext, toolCalls);
      } else {
        await this.runDeepAgent(runContext, request, timeoutMs);
      }

      this.emitStatus(runContext, 'completed');
    } catch (error) {
      if (this.isAbortError(error) || runContext.abortController.signal.aborted) {
        const message = runContext.canceledReason ?? 'Agent run canceled.';
        this.emitError(runContext, message, 'CANCELED');
        this.emitStatus(runContext, 'canceled');
      } else {
        this.emitError(runContext, error);
        this.emitStatus(runContext, 'failed');
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.activeRuns.delete(runId);
      runContext.memoryStore.clearRun(runId);
    }
  }

  private createRunContext(runId: string, request: AgentRunStartRequest): RunContext {
    if (this.activeRuns.has(runId)) {
      throw new Error(`Agent run already active: ${runId}`);
    }

    const allowlist = this.buildAllowlist(request);
    const memoryStore = new AgentMemoryStore(request.config?.memory ?? {});
    const runContext: RunContext = {
      runId,
      abortController: new AbortController(),
      memoryStore,
      allowlist,
      policyOverride: request.config?.policy,
      todoMap: new Map(),
    };

    this.activeRuns.set(runId, runContext);
    return runContext;
  }

  private buildAllowlist(request: AgentRunStartRequest): Set<string> | undefined {
    const allowlist = new Set<string>();
    for (const entry of request.toolAllowlist ?? []) {
      allowlist.add(entry);
    }
    for (const entry of request.config?.toolAllowlist ?? []) {
      allowlist.add(entry);
    }
    return allowlist.size > 0 ? allowlist : undefined;
  }

  private maybeScheduleTimeout(runId: string, timeoutMs?: number): NodeJS.Timeout | undefined {
    if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return undefined;
    }
    return setTimeout(() => {
      this.cancelRun(runId, `Agent run timed out after ${Math.round(timeoutMs)}ms.`);
    }, timeoutMs);
  }

  private async runToolCalls(runContext: RunContext, toolCalls: ToolCallEnvelope[]): Promise<void> {
    for (const toolCall of toolCalls) {
      const validatedCall = ToolCallEnvelopeSchema.parse(toolCall);
      if (validatedCall.runId !== runContext.runId) {
        throw new Error(`Tool call runId mismatch: ${validatedCall.runId}`);
      }
      const effectiveCall = runContext.policyOverride && !validatedCall.policyOverride
        ? { ...validatedCall, policyOverride: runContext.policyOverride }
        : validatedCall;
      await this.executeToolEnvelope(runContext, effectiveCall);
    }
  }

  private async runDeepAgent(
    runContext: RunContext,
    request: AgentRunStartRequest,
    timeoutMs?: number
  ): Promise<void> {
    const goalPrompt = this.buildGoalPrompt(request);
    const model = this.createModel(runContext, request);
    const backend = this.createBrokerBackend(runContext);
    const tools = this.buildCustomTools(runContext);
    const agent = this.createAgent({
      model,
      backend,
      tools,
    });

    const stream = agent.streamEvents(
      { messages: [new HumanMessage(goalPrompt)] },
      {
        version: 'v2',
        signal: runContext.abortController.signal,
        timeout: timeoutMs,
      }
    );

    for await (const event of stream) {
      this.handleStreamEvent(runContext, event);
    }
  }

  private createModel(runContext: RunContext, request: AgentRunStartRequest) {
    return new BrokeredModel({
      executeModelCall: (payload) =>
        this.executeToolCall(
          runContext,
          'model.generate',
          payload,
          'DeepAgents model.generate'
        ),
      connectionId: request.connectionId,
      modelRef: request.config?.modelRef,
      onLog: (output) => this.emitModelLog(runContext, output),
    });
  }

  private buildGoalPrompt(request: AgentRunStartRequest): string {
    const parts = [request.goal];

    if (request.inputs && Object.keys(request.inputs).length > 0) {
      parts.push('Inputs:', JSON.stringify(request.inputs, null, 2));
    }

    if (request.metadata && Object.keys(request.metadata).length > 0) {
      parts.push('Metadata:', JSON.stringify(request.metadata, null, 2));
    }

    return parts.join('\n\n');
  }

  private buildCustomTools(runContext: RunContext) {
    if (!runContext.allowlist || runContext.allowlist.size === 0) {
      return [];
    }

    const toolIds = Array.from(runContext.allowlist).filter(
      (toolId) => !RESERVED_TOOL_IDS.has(toolId)
    );

    return toolIds.map((toolId) =>
      tool(
        async (input) => {
          const result = await this.executeToolCall(
            runContext,
            toolId,
            input as JsonValue,
            `DeepAgents tool ${toolId}`
          );
          return result.output ?? null;
        },
        {
          name: toolId,
          description: `Broker tool ${toolId}`,
          schema: JsonValueSchema,
        }
      )
    );
  }

  private createBrokerBackend(runContext: RunContext): BackendProtocol {
    const executeToolCall = (
      toolId: string,
      input: JsonValue,
      reason: string
    ): Promise<ToolCallResult> => {
      return this.executeToolCall(runContext, toolId, input, reason);
    };
    const readFile = async (path: string): Promise<string> => {
      const result = await executeToolCall('workspace.read', { path }, 'FS read');
      const output = result.output as { content?: unknown } | undefined;
      if (!output || typeof output.content !== 'string') {
        throw new Error('workspace.read returned invalid content');
      }
      return output.content;
    };

    const writeFile = async (path: string, content: string, reason: string): Promise<void> => {
      await executeToolCall('workspace.write', { path, content }, reason);
    };

    const updateFile = async (path: string, content: string, reason: string): Promise<void> => {
      await executeToolCall('workspace.update', { path, content }, reason);
    };

    const toFileInfo = (paths: string[]): Array<{ path: string; is_dir?: boolean }> => {
      return paths.map((entry) => ({ path: entry, is_dir: false }));
    };

    const listByGlob = async (pattern: string): Promise<string[]> => {
      const result = await executeToolCall(
        'repo.list',
        { glob: pattern, maxResults: 2000 },
        'FS list'
      );
      const output = result.output as { files?: Array<unknown> } | undefined;
      if (!output || !Array.isArray(output.files)) {
        return [];
      }
      return output.files.filter((file): file is string => typeof file === 'string');
    };

    return {
      async lsInfo(path: string) {
        const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
        const pattern = `${normalized}/*`;
        const files = await listByGlob(pattern);
        return toFileInfo(files);
      },
      async read(filePath: string, offset = 0, limit = 2000) {
        const content = await readFile(filePath);
        const lines = content.split(/\r?\n/);
        const slice = lines.slice(offset, offset + limit);
        return slice
          .map((line, index) => `${offset + index + 1}: ${line}`)
          .join('\n');
      },
      async readRaw(filePath: string) {
        const content = await readFile(filePath);
        const timestamp = new Date().toISOString();
        return {
          content: content.split(/\r?\n/),
          created_at: timestamp,
          modified_at: timestamp,
        };
      },
      async grepRaw(pattern: string, path?: string | null, glob?: string | null) {
        const globValue = glob ?? (path ? `${path.replace(/\\/g, '/')}/**` : undefined);
        const searchInput: JsonValue = globValue
          ? { query: pattern, glob: globValue }
          : { query: pattern };
        const result = await executeToolCall(
          'repo.search',
          searchInput,
          'FS grep'
        );
        const output = result.output as {
          matches?: Array<{ file?: unknown; line?: unknown; text?: unknown }>;
        };
        if (!output || !Array.isArray(output.matches)) {
          return [];
        }
        return output.matches
          .map((match) => ({
            path: typeof match.file === 'string' ? match.file : '',
            line: typeof match.line === 'number' ? match.line : 0,
            text: typeof match.text === 'string' ? match.text : '',
          }))
          .filter((entry) => entry.path.length > 0 && entry.line > 0);
      },
      async globInfo(pattern: string, path?: string) {
        const base = path ? path.replace(/\\/g, '/') : '';
        const effective = base.length > 0 ? `${base}/${pattern}` : pattern;
        const files = await listByGlob(effective);
        return toFileInfo(files);
      },
      async write(filePath: string, content: string) {
        await writeFile(filePath, content, 'FS write');
        return { path: filePath, filesUpdate: null };
      },
      async edit(filePath: string, oldString: string, newString: string, replaceAll = false) {
        const content = await readFile(filePath);
        const occurrences = replaceAll
          ? content.split(oldString).length - 1
          : content.includes(oldString)
            ? 1
            : 0;
        if (occurrences === 0) {
          return { path: filePath, occurrences, filesUpdate: null };
        }
        const updated = replaceAll
          ? content.split(oldString).join(newString)
          : content.replace(oldString, newString);
        await updateFile(filePath, updated, 'FS edit');
        return { path: filePath, occurrences, filesUpdate: null };
      },
    };
  }

  private handleStreamEvent(runContext: RunContext, event: StreamEvent): void {
    if (!event || typeof event !== 'object') {
      return;
    }

    if (event.event === 'on_tool_start' || event.event === 'on_tool_end') {
      if (event.name !== 'write_todos') {
        return;
      }
      const candidate = event.data?.input ?? event.data?.output;
      const todos = this.parseTodoInput(candidate);
      if (todos.length > 0) {
        this.emitTodoEvents(runContext, todos);
      }
    }
  }

  private parseTodoInput(input: unknown): TodoItem[] {
    if (!input || typeof input !== 'object') {
      return [];
    }
    const candidate = input as { todos?: unknown };
    if (!Array.isArray(candidate.todos)) {
      return [];
    }
    return candidate.todos
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const todo = entry as { content?: unknown; status?: unknown };
        if (typeof todo.content !== 'string') {
          return null;
        }
        if (todo.status !== 'pending' && todo.status !== 'in_progress' && todo.status !== 'completed') {
          return null;
        }
        return { content: todo.content, status: todo.status };
      })
      .filter((item): item is TodoItem => Boolean(item));
  }

  private emitTodoEvents(runContext: RunContext, todos: TodoItem[]): void {
    const steps = todos.map((todo, index) => {
      const todoId = this.resolveTodoId(runContext, todo, index);
      return {
        stepId: todoId,
        title: todo.content,
        status: TODO_STATUS_MAP[todo.status],
      };
    });

    this.emitEvent(runContext, {
      id: this.idProvider(),
      runId: runContext.runId,
      timestamp: this.now(),
      type: 'plan',
      steps,
    });

    for (const step of steps) {
      this.emitEvent(runContext, {
        id: this.idProvider(),
        runId: runContext.runId,
        timestamp: this.now(),
        type: 'todo-update',
        todoId: step.stepId,
        title: step.title,
        status: step.status,
      });
    }
  }

  private resolveTodoId(runContext: RunContext, todo: TodoItem, index: number): string {
    const key = `${index}:${todo.content}`;
    const existing = runContext.todoMap.get(key);
    if (existing) {
      return existing;
    }
    const id = this.idProvider();
    runContext.todoMap.set(key, id);
    return id;
  }

  private async executeToolCall(
    runContext: RunContext,
    toolId: string,
    input: JsonValue,
    reason?: string
  ): Promise<ToolCallResult> {
    const envelope: ToolCallEnvelope = {
      callId: this.idProvider(),
      toolId,
      requesterId: 'agent-host',
      runId: runContext.runId,
      input,
      reason,
      policyOverride: runContext.policyOverride,
    };
    return this.executeToolEnvelope(runContext, envelope);
  }

  private async executeToolEnvelope(
    runContext: RunContext,
    envelope: ToolCallEnvelope
  ): Promise<ToolCallResult> {
    if (runContext.allowlist && !runContext.allowlist.has(envelope.toolId)) {
      throw new Error(`Tool not allowed: ${envelope.toolId}`);
    }

    const validated = ToolCallEnvelopeSchema.parse(envelope);

    this.emitEvent(runContext, {
      id: this.idProvider(),
      runId: runContext.runId,
      timestamp: this.now(),
      type: 'tool-call',
      toolCall: validated,
    });

    const startedAt = Date.now();
    let emittedResult = false;

    try {
      const result = await this.toolExecutor.executeToolCall(validated);
      this.emitEvent(runContext, {
        id: this.idProvider(),
        runId: runContext.runId,
        timestamp: this.now(),
        type: 'tool-result',
        result,
      });
      emittedResult = true;

      if (!result.ok) {
        if (result.error === 'POLICY_DENIED') {
          return result;
        }
        throw new Error(result.error ?? 'Tool call failed');
      }

      return result;
    } catch (error) {
      if (emittedResult) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Tool call failed';
      const failedResult: ToolCallResult = {
        callId: validated.callId,
        toolId: validated.toolId,
        runId: validated.runId,
        ok: false,
        error: message,
        durationMs: Math.max(0, Date.now() - startedAt),
      };

      this.emitEvent(runContext, {
        id: this.idProvider(),
        runId: runContext.runId,
        timestamp: this.now(),
        type: 'tool-result',
        result: failedResult,
      });

      throw error;
    }
  }

  private emitStatus(runContext: RunContext, status: AgentRunStatus): void {
    this.emitEvent(runContext, {
      id: this.idProvider(),
      runId: runContext.runId,
      timestamp: this.now(),
      type: 'status',
      status,
    });
  }

  private emitError(runContext: RunContext, error: unknown, code?: string): void {
    const message = error instanceof Error ? error.message : String(error ?? 'Agent run failed');
    this.emitEvent(runContext, {
      id: this.idProvider(),
      runId: runContext.runId,
      timestamp: this.now(),
      type: 'error',
      message,
      code,
    });
  }

  private emitEvent(runContext: RunContext, event: AgentEvent): void {
    const validated = AgentEventSchema.parse(event);
    this.recordMemory(runContext, validated);
    this.onEvent(validated);
  }

  private recordMemory(runContext: RunContext, event: AgentEvent): void {
    const summary: Record<string, JsonValue> = {
      type: event.type,
      timestamp: event.timestamp,
    };

    if (event.type === 'status') {
      summary.status = event.status;
    } else if (event.type === 'tool-call') {
      summary.toolId = event.toolCall.toolId;
    } else if (event.type === 'tool-result') {
      summary.toolId = event.result.toolId;
      summary.ok = event.result.ok;
      if (event.result.error) {
        summary.error = event.result.error;
      }
    } else if (event.type === 'todo-update') {
      summary.title = event.title;
      summary.status = event.status;
    } else if (event.type === 'plan-step') {
      summary.title = event.title;
      summary.status = event.status;
    }

    runContext.memoryStore.addEntry(runContext.runId, summary);
  }

  private emitModelLog(runContext: RunContext, output: string): void {
    const normalized = output.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return;
    }

    const truncated =
      normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;

    this.emitEvent(runContext, {
      id: this.idProvider(),
      runId: runContext.runId,
      timestamp: this.now(),
      type: 'log',
      level: 'info',
      message: truncated,
    });
  }

  private isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const name = (error as { name?: unknown }).name;
    return name === 'AbortError';
  }
}
