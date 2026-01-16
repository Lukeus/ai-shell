import type {
  AgentEvent,
  AgentRunStartRequest,
  SddRunEvent,
  SddRunStartRequest,
  SddRunControlRequest,
  ToolCallEnvelope,
  ToolCallResult,
} from 'packages-api-contracts';

export type StartRunMessage = {
  type: 'agent-host:start-run';
  runId: string;
  request: AgentRunStartRequest;
  toolCalls?: ToolCallEnvelope[];
};

export type CancelRunMessage = {
  type: 'agent-host:cancel-run';
  runId: string;
  reason?: string;
};

export type AgentHostEventMessage = {
  type: 'agent-host:event';
  event: AgentEvent;
};

export type AgentHostRunErrorMessage = {
  type: 'agent-host:run-error';
  runId: string;
  message: string;
};

export type AgentHostSddStartRunMessage = {
  type: 'agent-host:sdd-start-run';
  runId: string;
  request: SddRunStartRequest;
};

export type AgentHostSddControlRunMessage = {
  type: 'agent-host:sdd-control-run';
  request: SddRunControlRequest;
};

export type AgentHostSddEventMessage = {
  type: 'agent-host:sdd-event';
  event: SddRunEvent;
};

export type AgentHostSddRunErrorMessage = {
  type: 'agent-host:sdd-run-error';
  runId: string;
  message: string;
};

export type AgentHostToolCallMessage = {
  type: 'agent-host:tool-call';
  payload: ToolCallEnvelope;
};

export type AgentHostToolResultMessage = {
  type: 'agent-host:tool-result';
  payload: ToolCallResult;
};

export type AgentHostInboundMessage =
  | AgentHostEventMessage
  | AgentHostRunErrorMessage
  | AgentHostSddEventMessage
  | AgentHostSddRunErrorMessage
  | AgentHostToolCallMessage;

export type AgentHostOutboundMessage =
  | StartRunMessage
  | CancelRunMessage
  | AgentHostSddStartRunMessage
  | AgentHostSddControlRunMessage
  | AgentHostToolResultMessage;
