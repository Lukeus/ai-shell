import {
  AgentRunStartRequestSchema,
  SddRunControlRequestSchema,
  SddRunStartRequestSchema,
  ToolCallEnvelopeSchema,
} from 'packages-api-contracts';
import type {
  AgentEvent,
  AgentRunStartRequest,
  SddRunControlRequest,
  SddRunEvent,
  SddRunStartRequest,
  ToolCallEnvelope,
} from 'packages-api-contracts';
import { BrokerClient } from 'packages-broker-client';
import {
  DeepAgentRunner,
  EditWorkflowRunner,
  ChatWorkflowRunner,
  PlanningWorkflowRunner,
  SddWorkflowRunner,
} from 'packages-agent-runtime';

type StartRunMessage = {
  type: 'agent-host:start-run';
  runId: string;
  request: AgentRunStartRequest;
  toolCalls?: ToolCallEnvelope[];
};

type CancelRunMessage = {
  type: 'agent-host:cancel-run';
  runId: string;
  reason?: string;
};

type SddStartRunMessage = {
  type: 'agent-host:sdd-start-run';
  runId: string;
  request: SddRunStartRequest;
};

type SddControlRunMessage = {
  type: 'agent-host:sdd-control-run';
  request: SddRunControlRequest;
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

type SddEventMessage = {
  type: 'agent-host:sdd-event';
  event: SddRunEvent;
};

type SddRunErrorMessage = {
  type: 'agent-host:sdd-run-error';
  runId: string;
  message: string;
};

const sendToMain = (
  message: AgentEventMessage | AgentRunErrorMessage | SddEventMessage | SddRunErrorMessage
) => {
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

const parseCancelRunMessage = (message: unknown): CancelRunMessage | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const candidate = message as Partial<CancelRunMessage>;
  if (candidate.type !== 'agent-host:cancel-run' || !candidate.runId) {
    return null;
  }
  if (!isUuid(candidate.runId)) {
    return null;
  }

  return {
    type: 'agent-host:cancel-run',
    runId: candidate.runId,
    reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
  };
};

const parseSddStartRunMessage = (message: unknown): SddStartRunMessage | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const candidate = message as Partial<SddStartRunMessage>;
  if (candidate.type !== 'agent-host:sdd-start-run' || !candidate.runId || !candidate.request) {
    return null;
  }
  if (!isUuid(candidate.runId)) {
    return null;
  }

  const request = SddRunStartRequestSchema.safeParse(candidate.request);
  if (!request.success) {
    return null;
  }

  return {
    type: 'agent-host:sdd-start-run',
    runId: candidate.runId,
    request: request.data,
  };
};

const parseSddControlRunMessage = (message: unknown): SddControlRunMessage | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const candidate = message as Partial<SddControlRunMessage>;
  if (candidate.type !== 'agent-host:sdd-control-run' || !candidate.request) {
    return null;
  }

  const request = SddRunControlRequestSchema.safeParse(candidate.request);
  if (!request.success) {
    return null;
  }

  return {
    type: 'agent-host:sdd-control-run',
    request: request.data,
  };
};

const brokerClient = new BrokerClient();
const toolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => brokerClient.executeToolCall(envelope),
};
const runner = new DeepAgentRunner({
  toolExecutor,
  onEvent: (event: AgentEvent) => sendToMain({ type: 'agent-host:event', event }),
});
const planningRunner = new PlanningWorkflowRunner({
  toolExecutor,
  onEvent: (event: AgentEvent) => sendToMain({ type: 'agent-host:event', event }),
});
const chatRunner = new ChatWorkflowRunner({
  toolExecutor,
  onEvent: (event: AgentEvent) => sendToMain({ type: 'agent-host:event', event }),
});
const editRunner = new EditWorkflowRunner({
  toolExecutor,
  onEvent: (event: AgentEvent) => sendToMain({ type: 'agent-host:event', event }),
});
const sddRunner = new SddWorkflowRunner({
  toolExecutor,
  onEvent: (event: SddRunEvent) => sendToMain({ type: 'agent-host:sdd-event', event }),
});

const getPlanningFeatureId = (request: AgentRunStartRequest): string | null => {
  const metadataFeatureId = request.metadata?.featureId;
  if (typeof metadataFeatureId === 'string' && metadataFeatureId.trim().length > 0) {
    return metadataFeatureId.trim();
  }

  const inputs = request.inputs as Record<string, unknown> | undefined;
  const inputFeatureId = inputs?.featureId;
  if (typeof inputFeatureId === 'string' && inputFeatureId.trim().length > 0) {
    return inputFeatureId.trim();
  }

  return null;
};

const isPlanningRequest = (request: AgentRunStartRequest): boolean => {
  const workflow = request.metadata?.workflow;
  if (typeof workflow !== 'string') {
    return false;
  }
  const normalized = workflow.trim().toLowerCase();
  return normalized === 'planning' || normalized === 'draft';
};

const isEditRequest = (request: AgentRunStartRequest): boolean => {
  const workflow = request.metadata?.workflow;
  if (typeof workflow !== 'string') {
    return false;
  }
  return workflow.trim().toLowerCase() === 'edit';
};

const isChatRequest = (request: AgentRunStartRequest): boolean => {
  const workflow = request.metadata?.workflow;
  if (typeof workflow !== 'string') {
    return false;
  }
  return workflow.trim().toLowerCase() === 'chat';
};

const disposeBroker = () => brokerClient.dispose();
process.on('disconnect', disposeBroker);
process.on('exit', disposeBroker);

process.on('message', async (message: unknown) => {
  const cancelMessage = parseCancelRunMessage(message);
  if (cancelMessage) {
    runner.cancelRun(cancelMessage.runId, cancelMessage.reason);
    return;
  }

  const startMessage = parseStartRunMessage(message);
  if (!startMessage) {
    const sddStartMessage = parseSddStartRunMessage(message);
    if (sddStartMessage) {
      try {
        await sddRunner.startRun(sddStartMessage.runId, sddStartMessage.request);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'SDD run failed';
        sendToMain({
          type: 'agent-host:sdd-run-error',
          runId: sddStartMessage.runId,
          message: messageText,
        });
      }
      return;
    }

    const sddControlMessage = parseSddControlRunMessage(message);
    if (sddControlMessage) {
      try {
        sddRunner.controlRun(sddControlMessage.request);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'SDD control failed';
        sendToMain({
          type: 'agent-host:sdd-run-error',
          runId: sddControlMessage.request.runId,
          message: messageText,
        });
      }
      return;
    }

    return;
  }

  try {
    if (isEditRequest(startMessage.request)) {
      await editRunner.startRun(startMessage.runId, startMessage.request);
    } else if (isPlanningRequest(startMessage.request)) {
      const featureId = getPlanningFeatureId(startMessage.request);
      if (!featureId) {
        throw new Error('Planning runs require a featureId in metadata or inputs.');
      }
      await planningRunner.startRun(startMessage.runId, startMessage.request, featureId);
    } else if (isChatRequest(startMessage.request)) {
      await chatRunner.startRun(startMessage.runId, startMessage.request);
    } else {
      await runner.startRun(
        startMessage.runId,
        startMessage.request,
        startMessage.toolCalls ?? []
      );
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Agent run failed';
    sendToMain({ type: 'agent-host:run-error', runId: startMessage.runId, message: messageText });
  }
});
