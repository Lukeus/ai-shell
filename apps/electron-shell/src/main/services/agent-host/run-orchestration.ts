import {
  AgentRunStartRequestSchema,
  SddRunStartRequestSchema,
  SddRunControlRequestSchema,
  ToolCallEnvelopeSchema,
  type AgentRunStartRequest,
  type SddRunStartRequest,
  type SddRunControlRequest,
  type ToolCallEnvelope,
} from 'packages-api-contracts';
import type {
  AgentHostOutboundMessage,
  AgentHostSddControlRunMessage,
  AgentHostSddStartRunMessage,
  CancelRunMessage,
  StartRunMessage,
} from './agent-host-messages';
import type { BrokerMainInstance } from './types';

type SendAgentHostMessage = (message: AgentHostOutboundMessage) => void;

type AgentHostRunOrchestratorDeps = {
  brokerMain: BrokerMainInstance;
  sendMessage: SendAgentHostMessage;
};

export type AgentHostRunOrchestrator = {
  startRun: (runId: string, request: AgentRunStartRequest, toolCalls?: ToolCallEnvelope[]) => void;
  cancelRun: (runId: string, reason?: string) => void;
  startSddRun: (runId: string, request: SddRunStartRequest) => void;
  controlSddRun: (request: SddRunControlRequest) => void;
};

export const createAgentHostRunOrchestrator = (
  deps: AgentHostRunOrchestratorDeps
): AgentHostRunOrchestrator => {
  const { brokerMain, sendMessage } = deps;

  const startRun = (
    runId: string,
    request: AgentRunStartRequest,
    toolCalls: ToolCallEnvelope[] = []
  ): void => {
    const validatedRequest = AgentRunStartRequestSchema.parse(request);
    brokerMain.setRunPolicy(runId, validatedRequest.config?.policy);
    const validatedToolCalls = ToolCallEnvelopeSchema.array().parse(toolCalls);
    const message: StartRunMessage = {
      type: 'agent-host:start-run',
      runId,
      request: validatedRequest,
      toolCalls: validatedToolCalls,
    };

    sendMessage(message);
  };

  const cancelRun = (runId: string, reason?: string): void => {
    const message: CancelRunMessage = {
      type: 'agent-host:cancel-run',
      runId,
      reason,
    };

    sendMessage(message);
  };

  const startSddRun = (runId: string, request: SddRunStartRequest): void => {
    const validatedRequest = SddRunStartRequestSchema.parse(request);
    const message: AgentHostSddStartRunMessage = {
      type: 'agent-host:sdd-start-run',
      runId,
      request: validatedRequest,
    };

    sendMessage(message);
  };

  const controlSddRun = (request: SddRunControlRequest): void => {
    const validatedRequest = SddRunControlRequestSchema.parse(request);
    const message: AgentHostSddControlRunMessage = {
      type: 'agent-host:sdd-control-run',
      request: validatedRequest,
    };

    sendMessage(message);
  };

  return {
    startRun,
    cancelRun,
    startSddRun,
    controlSddRun,
  };
};
