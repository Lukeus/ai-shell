import { AgentRunStartRequestSchema, ToolCallEnvelopeSchema } from 'packages-api-contracts';
import type { AgentEvent, AgentRunStartRequest, ToolCallEnvelope } from 'packages-api-contracts';
import { DeepAgentRunner, ToolExecutor } from 'packages-agent-runtime';

type StartRunMessage = {
  type: 'agent-host:start-run';
  runId: string;
  request: AgentRunStartRequest;
  toolCalls?: ToolCallEnvelope[];
};

type AgentEventMessage = {
  type: 'agent-host:event';
  event: AgentEvent;
};

type AgentRunErrorMessage = {
  type: 'agent-host:run-error';
  runId: string;
  message: string;
};

const sendToMain = (message: AgentEventMessage | AgentRunErrorMessage) => {
  if (typeof process.send === 'function') {
    process.send(message);
  }
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const parseStartRunMessage = (message: unknown): StartRunMessage | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const candidate = message as Partial<StartRunMessage>;
  if (candidate.type !== 'agent-host:start-run' || !candidate.runId || !candidate.request) {
    return null;
  }
  if (!isUuid(candidate.runId)) {
    return null;
  }

  const request = AgentRunStartRequestSchema.safeParse(candidate.request);
  if (!request.success) {
    return null;
  }

  const toolCalls = candidate.toolCalls
    ? ToolCallEnvelopeSchema.array().safeParse(candidate.toolCalls)
    : null;

  if (candidate.toolCalls && (!toolCalls || !toolCalls.success)) {
    return null;
  }

  return {
    type: 'agent-host:start-run',
    runId: candidate.runId,
    request: request.data,
    toolCalls: toolCalls?.success ? toolCalls.data : undefined,
  };
};

const toolExecutor = new ToolExecutor();
const runner = new DeepAgentRunner({
  toolExecutor,
  onEvent: (event: AgentEvent) => sendToMain({ type: 'agent-host:event', event }),
});

process.on('message', async (message: unknown) => {
  const startMessage = parseStartRunMessage(message);
  if (!startMessage) {
    return;
  }

  try {
    await runner.startRun(startMessage.runId, startMessage.request, startMessage.toolCalls ?? []);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Agent run failed';
    sendToMain({ type: 'agent-host:run-error', runId: startMessage.runId, message: messageText });
  }
});
