import { randomUUID } from 'crypto';
import {
  AgentDraftSchema,
  AgentEventSchema,
  AgentRunStartRequestSchema,
  type AgentDraft,
  type AgentEvent,
  type AgentRunStartRequest,
  type JsonValue,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { PLANNING_SYSTEM_PROMPT } from './prompts';

export type PlanningToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

type PlanningWorkflowRunnerOptions = {
  toolExecutor: PlanningToolExecutor;
  onEvent: (event: AgentEvent) => void;
  now?: () => string;
  idProvider?: () => string;
};

export class PlanningWorkflowRunner {
  private readonly toolExecutor: PlanningToolExecutor;
  private readonly onEvent: (event: AgentEvent) => void;
  private readonly now: () => string;
  private readonly idProvider: () => string;

  constructor(options: PlanningWorkflowRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.onEvent = options.onEvent;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idProvider = options.idProvider ?? randomUUID;
  }

  public async startRun(
    runId: string,
    request: AgentRunStartRequest,
    featureId: string
  ): Promise<void> {
    const validatedRequest = AgentRunStartRequestSchema.parse(request);
    const prompt = this.buildPrompt(validatedRequest, featureId);
    const text = await this.generateWithModel(runId, validatedRequest, prompt, featureId);
    const draft = this.parseDraftOutput(text, featureId);

    this.emitEvent({
      id: this.idProvider(),
      runId,
      timestamp: this.now(),
      type: 'draft',
      draft,
    });
  }

  private buildPrompt(request: AgentRunStartRequest, featureId: string): string {
    const parts = [
      `Feature: ${featureId}`,
      `Goal: ${request.goal}`,
      '',
      'Provide spec, plan, and tasks that match repository conventions.',
    ];

    if (request.inputs && Object.keys(request.inputs).length > 0) {
      parts.push('Inputs:', JSON.stringify(request.inputs, null, 2));
    }

    return parts.join('\n');
  }

  private async generateWithModel(
    runId: string,
    request: AgentRunStartRequest,
    prompt: string,
    featureId: string
  ): Promise<string> {
    const input: JsonValue = {
      prompt,
      systemPrompt: PLANNING_SYSTEM_PROMPT,
    };

    if (request.connectionId) {
      (input as Record<string, JsonValue>).connectionId = request.connectionId;
    }

    if (request.config?.modelRef) {
      (input as Record<string, JsonValue>).modelRef = request.config.modelRef;
    }

    const envelope: ToolCallEnvelope = {
      callId: this.idProvider(),
      toolId: 'model.generate',
      requesterId: 'agent-host',
      runId,
      input,
      reason: `Planning draft for ${featureId}`,
    };

    const result = await this.toolExecutor.executeToolCall(envelope);
    if (!result.ok) {
      throw new Error(result.error ?? 'model.generate failed');
    }

    const output = result.output as { text?: unknown };
    if (!output || typeof output.text !== 'string') {
      throw new Error('model.generate returned invalid output');
    }

    return output.text;
  }

  private parseDraftOutput(text: string, featureId: string): AgentDraft {
    const normalized = this.normalizeModelOutput(text);
    const sections = this.parseMarkdownSections(normalized);
    const candidate = {
      featureId,
      spec: sections.spec,
      plan: sections.plan,
      tasks: sections.tasks,
      status: 'draft',
    };

    return AgentDraftSchema.parse(candidate);
  }

  private normalizeModelOutput(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
    return match ? match[1].trimEnd() : trimmed;
  }

  private parseMarkdownSections(text: string): { spec: string; plan: string; tasks: string } {
    const pattern = /^#\s*(spec\.md|plan\.md|tasks\.md)\s*$/gim;
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length < 3) {
      throw new Error(
        'Draft output must include headings: "# spec.md", "# plan.md", "# tasks.md".'
      );
    }

    const sections: Record<string, string> = {};
    for (let i = 0; i < matches.length; i += 1) {
      const match = matches[i];
      const title = match[1].toLowerCase();
      const start = (match.index ?? 0) + match[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
      const content = text.slice(start, end).trim();
      sections[title] = content;
    }

    const spec = sections['spec.md'] ?? '';
    const plan = sections['plan.md'] ?? '';
    const tasks = sections['tasks.md'] ?? '';

    if (!spec || !plan || !tasks) {
      throw new Error(
        'Draft output must include non-empty sections for spec.md, plan.md, and tasks.md.'
      );
    }

    return { spec, plan, tasks };
  }

  private emitEvent(event: AgentEvent): void {
    const validated = AgentEventSchema.parse(event);
    this.onEvent(validated);
  }
}
