import { useCallback, useMemo, useState } from 'react';
import { TabBar } from 'packages-ui-kit';
import type { AgentDraft, AgentEvent } from 'packages-api-contracts';
import { useSddStatus } from '../../hooks/useSddStatus';
import { useAgentConversations } from '../../hooks/useAgentConversations';
import { useAgentEventStream } from '../../hooks/useAgentEventStream';
import { useAgentRuns } from '../../hooks/useAgentRuns';
import { AgentsRunsView } from './AgentsRunsView';
import { AgentsConversationsView } from './AgentsConversationsView';

type AgentsTab = 'conversations' | 'runs';

export function AgentsPanel() {
  const [activeTab, setActiveTab] = useState<AgentsTab>('conversations');
  const runs = useAgentRuns();
  const conversations = useAgentConversations();
  const { enabled: sddEnabled } = useSddStatus();

  const subscribedRunId = activeTab === 'runs'
    ? runs.activeRunId
    : conversations.activeChatRunId ??
      conversations.activeEditRunId ??
      conversations.activeDraftRunId;

  const handleRunEvent = runs.handleAgentEvent;
  const handleConversationEvent = conversations.handleAgentEvent;

  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      handleRunEvent(event);
      handleConversationEvent(event);
    },
    [handleConversationEvent, handleRunEvent]
  );

  useAgentEventStream({ runId: subscribedRunId, onEvent: handleAgentEvent });

  const tabs = useMemo(
    () => [
      { id: 'conversations', label: 'Conversations' },
      { id: 'runs', label: 'Runs' },
    ],
    []
  );

  const handleRunSdd = useCallback(
    async (draft: AgentDraft, goal: string) => {
      const trimmedGoal = goal.trim();
      if (!trimmedGoal) {
        await conversations.appendMessage('Add a goal before running SDD.', 'system');
        return;
      }
      try {
        await window.api.sddRuns.start({
          featureId: draft.featureId,
          goal: trimmedGoal,
          step: 'spec',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start SDD run.';
        await conversations.appendMessage(message, 'system');
      }
    },
    [conversations]
  );

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-surface">
      <TabBar
        tabs={tabs}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as AgentsTab)}
        className="border-b border-border-subtle"
      />
      <div className="flex-1 min-h-0">
        {activeTab === 'conversations' ? (
          <AgentsConversationsView
            conversations={conversations.conversations}
            selectedConversationId={conversations.selectedConversationId}
            entries={conversations.entries}
            draft={conversations.draft}
            isLoading={conversations.isLoading}
            isSavingDraft={conversations.isSavingDraft}
            errorMessage={conversations.errorMessage}
            sddEnabled={sddEnabled}
            onSelectConversation={conversations.selectConversation}
            onCreateConversation={() => conversations.createConversation()}
            onSendMessage={(content, attachments) =>
              conversations.sendMessage(content, attachments)
            }
            onRequestEdit={(content, attachments, options) =>
              conversations.requestEdit(content, attachments, options)
            }
            onDraftRequest={conversations.startDraft}
            onSaveDraft={conversations.saveDraft}
            onRunSdd={handleRunSdd}
            onApplyProposal={conversations.applyProposal}
            onDiscardProposal={conversations.discardProposal}
            isApplyingProposal={conversations.isApplyingProposal}
            isProposalDiscarded={conversations.isProposalDiscarded}
            proposalApplyResult={conversations.proposalApplyResult}
            proposalApplyError={conversations.proposalApplyError}
          />
        ) : (
          <AgentsRunsView
            runs={runs.runs}
            activeRunId={runs.activeRunId}
            activeRun={runs.activeRun}
            events={runs.events}
            isBusy={runs.isBusy}
            errorMessage={runs.errorMessage}
            onSelectRun={(runId) => runs.setSelectedRunId(runId)}
            onStartRun={runs.startRun}
            onCancelRun={runs.cancelRun}
            onRetryRun={runs.retryRun}
          />
        )}
      </div>
    </div>
  );
}


