import { randomUUID } from 'crypto';
import type {
  AgentEditRequest,
  AgentEditRequestResponse,
  ApplyAgentEditProposalRequest,
  ApplyAgentEditProposalResponse,
  DiscardAgentEditProposalRequest,
  DiscardAgentEditProposalResponse,
  AgentEvent,
  AgentRunStartRequest,
  AgentRunStatus,
  Proposal,
} from 'packages-api-contracts';
import { AgentEventSchema } from 'packages-api-contracts';
import { agentConversationStore } from './AgentConversationStore';
import { agentRunStore } from './AgentRunStore';
import { auditService } from './AuditService';
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

  private getTrackedProposalEntry(
    conversationId: string,
    entryId: string
  ) {
    return agentConversationStore.getProposalEntry(conversationId, entryId);
  }

  private resolveProposalForApply(
    request: ApplyAgentEditProposalRequest
  ): Proposal | null {
    if (request.proposal) {
      return request.proposal;
    }

    if (!request.conversationId || !request.entryId) {
      return null;
    }

    return agentConversationStore.resolveProposalContent(
      request.conversationId,
      request.entryId
    );
  }

  private assertProposalStateForApply(state: 'pending' | 'applied' | 'discarded' | 'failed'): void {
    if (state === 'applied') {
      throw new Error('Proposal has already been applied.');
    }
    if (state === 'discarded') {
      throw new Error('Discarded proposals cannot be applied.');
    }
  }

  private assertProposalStateForDiscard(
    state: 'pending' | 'applied' | 'discarded' | 'failed'
  ): void {
    if (state === 'applied') {
      throw new Error('Applied proposals cannot be discarded.');
    }
    if (state === 'discarded') {
      throw new Error('Proposal has already been discarded.');
    }
  }

  private resolveConversationOverrides(conversationId: string): {
    connectionId?: string;
    modelRef?: string;
  } {
    try {
      const { conversation } = agentConversationStore.getConversation(conversationId);
      return {
        connectionId: conversation.connectionId,
        modelRef: conversation.modelRef,
      };
    } catch {
      return {};
    }
  }

  private warnMissingConversationConnection(
    conversationId: string,
    connectionId: string
  ): void {
    try {
      agentConversationStore.appendMessage({
        conversationId,
        role: 'system',
        content: `Connection ${connectionId} not found. Using default connection.`,
      });
    } catch {
      // Ignore failures when writing warning messages.
    }
  }

  public async requestEdit(
    request: AgentEditRequest
  ): Promise<AgentEditRequestResponse> {
    agentConversationStore.getConversation(request.conversationId);

    const run = agentRunStore.createRun('user');
    const settings = settingsService.getSettings();
    const overrides = this.resolveConversationOverrides(request.conversationId);
    const defaultConnectionId = settings.agents.defaultConnectionId;
    const explicitConnectionId = request.connectionId;
    let resolvedConnectionId =
      explicitConnectionId ?? overrides.connectionId ?? defaultConnectionId;

    const failRun = (message: string): never => {
      this.appendRunError(run.id, message);
      throw new Error(message);
    };

    if (!resolvedConnectionId) {
      failRun('No connection configured for this run.');
    }

    let connection = connectionsService
      .listConnections()
      .find((item) => item.metadata.id === resolvedConnectionId);

    if (!connection && overrides.connectionId && !explicitConnectionId) {
      this.warnMissingConversationConnection(request.conversationId, overrides.connectionId);
      resolvedConnectionId = defaultConnectionId ?? resolvedConnectionId;
      connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === resolvedConnectionId);
    }

    if (!connection) {
      failRun(`Connection not found: ${resolvedConnectionId}`);
    }

    const connectionModel = getConnectionModelRef(connection!);
    const overrideModelRef =
      !request.modelRef &&
      overrides.modelRef &&
      (!overrides.connectionId || overrides.connectionId === resolvedConnectionId)
        ? overrides.modelRef
        : undefined;
    const effectiveModelRef = request.modelRef ?? overrideModelRef ?? connectionModel;

    agentRunStore.updateRunRouting(run.id, {
      connectionId: resolvedConnectionId!,
      providerId: connection!.metadata.providerId,
      modelRef: effectiveModelRef,
    });

    const agentHostManager = getAgentHostManager();
    if (!agentHostManager) {
      failRun('Agent Host not available.');
    }

    const runRequest: AgentRunStartRequest = {
      goal: request.prompt,
      connectionId: resolvedConnectionId!,
      inputs: {
        conversationId: request.conversationId,
        ...(request.attachments ? { attachments: request.attachments } : {}),
        ...(request.options ? { options: request.options } : {}),
      },
      metadata: {
        workflow: EDIT_WORKFLOW,
        conversationId: request.conversationId,
      },
      config: effectiveModelRef ? { modelRef: effectiveModelRef } : undefined,
    };

    this.runContexts.set(run.id, { conversationId: request.conversationId });

    try {
      await agentHostManager!.startRun(run.id, runRequest);
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

    const trackedEntry =
      request.conversationId && request.entryId
        ? this.getTrackedProposalEntry(request.conversationId, request.entryId)
        : null;
    if (trackedEntry) {
      this.assertProposalStateForApply(trackedEntry.state);
    }

    const proposal = this.resolveProposalForApply(request);
    if (!proposal) {
      const message = 'Proposal content is unavailable. Regenerate the proposal and try again.';
      if (request.conversationId && request.entryId) {
        try {
          agentConversationStore.markProposalFailed(
            request.conversationId,
            request.entryId,
            message
          );
        } catch {
          // Ignore persistence failures for unavailable proposals.
        }
      }
      throw new Error(message);
    }

    try {
      const result = await patchApplyService.applyProposal(
        proposal,
        workspace.path
      );
      const appliedAt =
        request.conversationId && request.entryId
          ? agentConversationStore.markProposalApplied(
              request.conversationId,
              request.entryId
            ).appliedAt ?? new Date().toISOString()
          : new Date().toISOString();
      auditService.logAgentProposalApply({
        conversationId: request.conversationId,
        entryId: request.entryId,
        status: 'success',
        filesChanged: result.summary.filesChanged,
        files: result.files,
      });
      return {
        files: result.files,
        summary: result.summary,
        state: 'applied',
        appliedAt,
      };
    } catch (error) {
      if (request.conversationId && request.entryId) {
        const message =
          error instanceof Error ? error.message : 'Failed to apply proposal.';
        try {
          agentConversationStore.markProposalFailed(
            request.conversationId,
            request.entryId,
            message
          );
        } catch {
          // Ignore persistence failures when the apply already failed.
        }
      }
      auditService.logAgentProposalApply({
        conversationId: request.conversationId,
        entryId: request.entryId,
        status: 'error',
        filesChanged: 0,
        error: error instanceof Error ? error.message : 'Failed to apply proposal.',
      });
      throw error;
    }
  }

  public discardProposal(
    request: DiscardAgentEditProposalRequest
  ): DiscardAgentEditProposalResponse {
    const entry = this.getTrackedProposalEntry(
      request.conversationId,
      request.entryId
    );
    this.assertProposalStateForDiscard(entry.state);
    const discarded = agentConversationStore.markProposalDiscarded(
      request.conversationId,
      request.entryId
    );
    auditService.logAgentProposalDiscard({
      conversationId: request.conversationId,
      entryId: request.entryId,
    });

    return {
      state: 'discarded',
      discardedAt: discarded.discardedAt ?? new Date().toISOString(),
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
