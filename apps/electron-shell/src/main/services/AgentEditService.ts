import { randomUUID } from 'crypto';
import type {
  AgentEditRequest,
  AgentEditRequestResponse,
  ApplyAgentEditProposalRequest,
  ApplyAgentEditProposalResponse,
  AgentEvent,
  AgentRunStartRequest,
  AgentRunStatus,
} from 'packages-api-contracts';
import { AgentEventSchema } from 'packages-api-contracts';
import { agentConversationStore } from './AgentConversationStore';
import { agentRunStore } from './AgentRunStore';
import { connectionsService } from './ConnectionsService';
import { getConnectionModelRef } from './connection-model-ref';
import { settingsService } from './SettingsService';
import { workspaceService } from './WorkspaceService';
import { patchApplyService } from './PatchApplyService';
import { getAgentHostManager } from '../index';

type EditRunContext = {
  conversationId: string;
};

const EDIT_WORKFLOW = 'edit';
const FINAL_RUN_STATUSES: AgentRunStatus[] = ['completed', 'failed', 'canceled'];

export class AgentEditService {
  private readonly runContexts = new Map<string, EditRunContext>();

  public async requestEdit(
    request: AgentEditRequest
  ): Promise<AgentEditRequestResponse> {
    agentConversationStore.getConversation(request.conversationId);

    const run = agentRunStore.createRun('user');
    const settings = settingsService.getSettings();
    const resolvedConnectionId =
      request.connectionId ?? settings.agents.defaultConnectionId;

    const failRun = (message: string): never => {
      this.appendRunError(run.id, message);
      throw new Error(message);
    };

    if (!resolvedConnectionId) {
      failRun('No connection configured for this run.');
    }

    const connection = connectionsService
      .listConnections()
      .find((item) => item.metadata.id === resolvedConnectionId);

    if (!connection) {
      failRun(`Connection not found: ${resolvedConnectionId}`);
    }

    const connectionModel = getConnectionModelRef(connection);
    const effectiveModelRef = request.modelRef ?? connectionModel;

    agentRunStore.updateRunRouting(run.id, {
      connectionId: resolvedConnectionId,
      providerId: connection.metadata.providerId,
      modelRef: effectiveModelRef,
    });

    const agentHostManager = getAgentHostManager();
    if (!agentHostManager) {
      failRun('Agent Host not available.');
    }

    const runRequest: AgentRunStartRequest = {
      goal: request.prompt,
      connectionId: resolvedConnectionId,
      inputs: {
        conversationId: request.conversationId,
        attachments: request.attachments,
        options: request.options,
      },
      metadata: {
        workflow: EDIT_WORKFLOW,
        conversationId: request.conversationId,
      },
      config: effectiveModelRef ? { modelRef: effectiveModelRef } : undefined,
    };

    this.runContexts.set(run.id, { conversationId: request.conversationId });

    try {
      await agentHostManager.startRun(run.id, runRequest);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start edit run.';
      this.runContexts.delete(run.id);
      this.appendRunError(run.id, message);
      throw error;
    }

    return { runId: run.id };
  }

  public async applyProposal(
    request: ApplyAgentEditProposalRequest
  ): Promise<ApplyAgentEditProposalResponse> {
    const workspace = workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder to apply edits.');
    }

    const result = await patchApplyService.applyProposal(
      request.proposal,
      workspace.path
    );
    return {
      files: result.files,
      summary: result.summary,
    };
  }

  public handleAgentEvent(event: AgentEvent): AgentEvent {
    if (event.type === 'status' && FINAL_RUN_STATUSES.includes(event.status)) {
      this.runContexts.delete(event.runId);
      return event;
    }

    if (event.type !== 'edit-proposal') {
      return event;
    }

    const conversationId =
      event.conversationId ?? this.runContexts.get(event.runId)?.conversationId;

    if (!conversationId) {
      return event;
    }

    try {
      agentConversationStore.appendProposal(conversationId, event.proposal);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to persist edit proposal.';
      console.warn('[AgentEditService] Failed to persist edit proposal.', message);
    }

    if (!event.conversationId) {
      return { ...event, conversationId };
    }

    return event;
  }

  private appendRunError(runId: string, message: string): void {
    try {
      agentRunStore.updateRunStatus(runId, 'failed');
    } catch {
      // Ignore missing runs.
    }

    try {
      const event = AgentEventSchema.parse({
        id: randomUUID(),
        runId,
        timestamp: new Date().toISOString(),
        type: 'error',
        message,
      });
      agentRunStore.appendEvent(event);
    } catch {
      // Ignore event persistence failures.
    }
  }
}

export const agentEditService = new AgentEditService();
