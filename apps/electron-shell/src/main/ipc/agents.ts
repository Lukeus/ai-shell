import { ipcMain, type WebContents } from 'electron';
import { randomUUID } from 'crypto';
import {
  AgentEventSchema,
  AgentEventSubscriptionRequestSchema,
  AgentRunControlRequestSchema,
  AgentRunStartRequestSchema,
  AppendAgentMessageRequestSchema,
  AppendAgentMessageResponseSchema,
  CreateAgentConversationRequestSchema,
  CreateAgentConversationResponseSchema,
  GetAgentRunRequestSchema,
  GetAgentConversationRequestSchema,
  GetAgentConversationResponseSchema,
  IPC_CHANNELS,
  ListAgentConversationsResponseSchema,
  SaveAgentDraftRequestSchema,
  SaveAgentDraftResponseSchema,
  ListAgentTraceRequestSchema,
  type AgentEvent,
  type AgentRunControlResponse,
  type AgentRunStartRequest,
  type AgentRunStartResponse,
  type AgentRunStatus,
  type GetAgentRunResponse,
  type ListAgentRunsResponse,
  type ListAgentTraceResponse,
} from 'packages-api-contracts';
import { agentRunStore } from '../services/AgentRunStore';
import { agentConversationStore } from '../services/AgentConversationStore';
import { agentDraftService } from '../services/AgentDraftService';
import { connectionsService } from '../services/ConnectionsService';
import { settingsService } from '../services/SettingsService';
import { getAgentHostManager } from '../index';
import { handleSafe } from './safeIpc';

type AgentSubscriber = {
  sender: WebContents;
  runId?: string;
};

const agentSubscribers = new Map<number, AgentSubscriber>();
const cachedRunRequests = new Map<string, AgentRunStartRequest>();
let agentHostBindingsReady = false;

const registerAgentSubscriber = (sender: WebContents, runId?: string): void => {
  const existing = agentSubscribers.get(sender.id);
  agentSubscribers.set(sender.id, { sender, runId });
  if (!existing) {
    sender.once('destroyed', () => {
      agentSubscribers.delete(sender.id);
    });
  }
};

const unregisterAgentSubscriber = (sender: WebContents): void => {
  agentSubscribers.delete(sender.id);
};

const redactSensitiveData = (data: unknown): unknown => {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        (lowerKey.includes('key') && !lowerKey.includes('keyname'))
      ) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  return data;
};

const redactAgentEventForPublish = (event: AgentEvent): AgentEvent => {
  if (event.type === 'tool-call') {
    return {
      ...event,
      toolCall: {
        ...event.toolCall,
        input: redactSensitiveData(event.toolCall.input) as typeof event.toolCall.input,
      },
    };
  }

  if (event.type === 'tool-result') {
    return {
      ...event,
      result: {
        ...event.result,
        output: event.result.output
          ? (redactSensitiveData(event.result.output) as typeof event.result.output)
          : undefined,
      },
    };
  }

  return event;
};

const logInvalidAgentEvent = (error: unknown): void => {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = Array.isArray((error as { issues?: unknown }).issues)
      ? (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues.map(
          (issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })
        )
      : undefined;
    console.warn('[Agent IPC] Dropping invalid agent event.', issues);
    return;
  }

  console.warn('[Agent IPC] Dropping invalid agent event.');
};

const publishAgentEvent = (event: AgentEvent): void => {
  const redacted = redactAgentEventForPublish(event);
  const parsed = AgentEventSchema.safeParse(redacted);
  if (!parsed.success) {
    logInvalidAgentEvent(parsed.error);
    return;
  }
  const validated = parsed.data;
  for (const subscriber of agentSubscribers.values()) {
    if (subscriber.sender.isDestroyed()) {
      agentSubscribers.delete(subscriber.sender.id);
      continue;
    }
    if (subscriber.runId && subscriber.runId !== validated.runId) {
      continue;
    }
    try {
      subscriber.sender.send(IPC_CHANNELS.AGENT_EVENTS_ON_EVENT, validated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[Agent IPC] Failed to publish agent event.', message);
    }
  }
};

const appendAndPublish = (event: AgentEvent): void => {
  if (event.type === 'status') {
    try {
      agentRunStore.updateRunStatus(event.runId, event.status);
    } catch {
      // Ignore missing runs; events may arrive before metadata is created.
    }
  }

  try {
    agentRunStore.appendEvent(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Agent IPC] Failed to persist agent event.', message);
  }

  publishAgentEvent(event);
};

const buildStatusEvent = (runId: string, status: AgentRunStatus): AgentEvent =>
  AgentEventSchema.parse({
    id: randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    type: 'status',
    status,
  });

const appendRunError = (runId: string, message: string): void => {
  appendAndPublish(
    AgentEventSchema.parse({
      id: randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      type: 'error',
      message,
    })
  );
};

const ensureAgentHostBindings = (): void => {
  if (agentHostBindingsReady) {
    return;
  }

  const agentHostManager = getAgentHostManager();
  if (!agentHostManager) {
    return;
  }

  agentHostManager.onEvent((event) => {
    appendAndPublish(event);
  });

  agentHostManager.onRunError((runId, message) => {
    appendRunError(runId, message);
    try {
      agentRunStore.updateRunStatus(runId, 'failed');
    } catch {
      // Ignore missing runs; failure event is still published.
    }
  });

  agentHostBindingsReady = true;
};

export const registerAgentHandlers = (): void => {
  ensureAgentHostBindings();

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_LIST,
    async (): Promise<ListAgentRunsResponse> => {
      const runs = agentRunStore.listRuns();
      return { runs };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_GET,
    async (_event, request: unknown): Promise<GetAgentRunResponse> => {
      const validated = GetAgentRunRequestSchema.parse(request);
      const run = agentRunStore.getRun(validated.runId);
      if (!run) {
        throw new Error(`Agent run not found: ${validated.runId}`);
      }
      return { run };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_START,
    async (_event, request: unknown): Promise<AgentRunStartResponse> => {
      const validated = AgentRunStartRequestSchema.parse(request);
      let run = agentRunStore.createRun('user');
      appendAndPublish(buildStatusEvent(run.id, run.status));

      const failRun = (message: string): AgentRunStartResponse => {
        const failedRun = agentRunStore.updateRunStatus(run.id, 'failed');
        appendRunError(run.id, message);
        return { run: failedRun };
      };

      const settings = settingsService.getSettings();
      const resolvedConnectionId =
        validated.connectionId ?? settings.agents.defaultConnectionId;

      if (!resolvedConnectionId) {
        return failRun('No connection configured for this run.');
      }

      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === resolvedConnectionId);

      if (!connection) {
        return failRun(`Connection not found: ${resolvedConnectionId}`);
      }

      const connectionModel =
        typeof connection.config.model === 'string' ? connection.config.model : undefined;
      const effectiveModelRef = validated.config?.modelRef ?? connectionModel;

      run = agentRunStore.updateRunRouting(run.id, {
        connectionId: resolvedConnectionId,
        providerId: connection.metadata.providerId,
        modelRef: effectiveModelRef,
      });

      ensureAgentHostBindings();
      const agentHostManager = getAgentHostManager();
      if (!agentHostManager) {
        return failRun('Agent Host not available.');
      }

      const requestForHost: AgentRunStartRequest = {
        ...validated,
        connectionId: resolvedConnectionId,
      };
      cachedRunRequests.set(run.id, requestForHost);

      try {
        await agentHostManager.startRun(run.id, requestForHost);
        return { run };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start agent run';
        return failRun(message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_CANCEL,
    async (_event, request: unknown): Promise<AgentRunControlResponse> => {
      const validated = AgentRunControlRequestSchema.parse(request);
      if (validated.action !== 'cancel') {
        throw new Error('Invalid action for cancel endpoint.');
      }
      const run = agentRunStore.updateRunStatus(validated.runId, 'canceled');
      appendAndPublish(buildStatusEvent(run.id, run.status));

      ensureAgentHostBindings();
      const agentHostManager = getAgentHostManager();
      await agentHostManager?.cancelRun(validated.runId, validated.reason);

      return { run };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUNS_RETRY,
    async (_event, request: unknown): Promise<AgentRunControlResponse> => {
      const validated = AgentRunControlRequestSchema.parse(request);
      if (validated.action !== 'retry') {
        throw new Error('Invalid action for retry endpoint.');
      }

      const cachedRequest = cachedRunRequests.get(validated.runId);
      if (!cachedRequest) {
        throw new Error('No cached start request for this run.');
      }

      agentRunStore.resetRunEvents(validated.runId);
      let run = agentRunStore.updateRunStatus(validated.runId, 'queued');
      appendAndPublish(buildStatusEvent(run.id, run.status));

      const agentHostManager = getAgentHostManager();
      if (!agentHostManager) {
        const failedRun = agentRunStore.updateRunStatus(run.id, 'failed');
        appendRunError(run.id, 'Agent Host not available.');
        return { run: failedRun };
      }

      try {
        await agentHostManager.startRun(run.id, cachedRequest);
        return { run };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to retry agent run';
        const failedRun = agentRunStore.updateRunStatus(run.id, 'failed');
        appendRunError(run.id, message);
        return { run: failedRun };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_TRACE_LIST,
    async (_event, request: unknown): Promise<ListAgentTraceResponse> => {
      const validated = ListAgentTraceRequestSchema.parse(request);
      return agentRunStore.listEvents(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_EVENTS_SUBSCRIBE,
    async (event, request: unknown): Promise<void> => {
      const validated = AgentEventSubscriptionRequestSchema.parse(request ?? {});
      if (!event?.sender) {
        return;
      }
      registerAgentSubscriber(event.sender, validated.runId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_EVENTS_UNSUBSCRIBE,
    async (event, request: unknown): Promise<void> => {
      AgentEventSubscriptionRequestSchema.parse(request ?? {});
      if (!event?.sender) {
        return;
      }
      unregisterAgentSubscriber(event.sender);
    }
  );

  handleSafe(
    IPC_CHANNELS.AGENT_CONVERSATIONS_LIST,
    { outputSchema: ListAgentConversationsResponseSchema },
    async () => ({
      conversations: agentConversationStore.listConversations(),
    })
  );

  handleSafe(
    IPC_CHANNELS.AGENT_CONVERSATIONS_CREATE,
    {
      inputSchema: CreateAgentConversationRequestSchema,
      outputSchema: CreateAgentConversationResponseSchema,
    },
    async (_event, request) => ({
      conversation: agentConversationStore.createConversation(request.title),
    })
  );

  handleSafe(
    IPC_CHANNELS.AGENT_CONVERSATIONS_GET,
    {
      inputSchema: GetAgentConversationRequestSchema,
      outputSchema: GetAgentConversationResponseSchema,
    },
    async (_event, request) =>
      agentConversationStore.getConversation(request.conversationId)
  );

  handleSafe(
    IPC_CHANNELS.AGENT_MESSAGES_APPEND,
    {
      inputSchema: AppendAgentMessageRequestSchema,
      outputSchema: AppendAgentMessageResponseSchema,
    },
    async (_event, request) => ({
      message: agentConversationStore.appendMessage(request),
    })
  );

  handleSafe(
    IPC_CHANNELS.AGENT_DRAFTS_SAVE,
    {
      inputSchema: SaveAgentDraftRequestSchema,
      outputSchema: SaveAgentDraftResponseSchema,
    },
    async (_event, request) => agentDraftService.saveDraft(request)
  );
};
