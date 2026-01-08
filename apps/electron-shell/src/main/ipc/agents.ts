import { ipcMain, type WebContents } from 'electron';
import { randomUUID } from 'crypto';
import {
  AgentEventSchema,
  AgentEventSubscriptionRequestSchema,
  AgentRunControlRequestSchema,
  AgentRunStartRequestSchema,
  AgentEditRequestSchema,
  AgentEditRequestResponseSchema,
  ApplyAgentEditProposalRequestSchema,
  ApplyAgentEditProposalResponseSchema,
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
import { agentEditService } from '../services/AgentEditService';
import { connectionsService } from '../services/ConnectionsService';
import { getConnectionModelRef } from '../services/connection-model-ref';
import { settingsService } from '../services/SettingsService';
import { getAgentHostManager } from '../index';
import { handleSafe } from './safeIpc';
import { logInvalidAgentEvent, redactAgentEventForPublish } from './agent-event-redaction';

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
  const enriched = agentEditService.handleAgentEvent(event);
  if (enriched.type === 'status') {
    try {
      agentRunStore.updateRunStatus(enriched.runId, enriched.status);
    } catch {
      // Ignore missing runs; events may arrive before metadata is created.
    }
  }

  try {
    agentRunStore.appendEvent(enriched);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Agent IPC] Failed to persist agent event.', message);
  }

  publishAgentEvent(enriched);
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

      const connectionModel = getConnectionModelRef(connection);
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

  handleSafe(
    IPC_CHANNELS.AGENT_EDITS_REQUEST,
    {
      inputSchema: AgentEditRequestSchema,
      outputSchema: AgentEditRequestResponseSchema,
    },
    async (_event, request) => {
      const response = await agentEditService.requestEdit(request);
      appendAndPublish(buildStatusEvent(response.runId, 'queued'));
      return response;
    }
  );

  handleSafe(
    IPC_CHANNELS.AGENT_EDITS_APPLY_PROPOSAL,
    {
      inputSchema: ApplyAgentEditProposalRequestSchema,
      outputSchema: ApplyAgentEditProposalResponseSchema,
    },
    async (_event, request) => agentEditService.applyProposal(request)
  );
};
