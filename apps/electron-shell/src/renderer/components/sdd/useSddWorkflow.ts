import { useEffect, useRef, useState } from 'react';
import type {
  Connection,
  Proposal,
  SddRunEvent,
  SddStep,
  SecretAccessRequest,
  SecretAccessResponse,
  Settings,
} from 'packages-api-contracts';
import { describeMissingConnection } from '../../utils/agentConnections';
import type { SddTaskItem } from './SddTaskListSection';
import {
  applyGoalTemplate,
  getNextTaskId,
  parseSlashCommand,
  type CustomSlashCommand,
} from './SddPanel.utils';

type ResolveWorkflowConnection = () => Promise<{
  connectionId: string | null;
  connections: Connection[];
  settings: Settings;
}>;

type UseSddWorkflowParams = {
  enabled: boolean;
  selectedFeatureId: string | null;
  selectedTaskId: string | null;
  tasks: SddTaskItem[];
  customCommands: CustomSlashCommand[];
  requestSecretAccess: (request: SecretAccessRequest) => Promise<SecretAccessResponse>;
  resolveWorkflowConnection: ResolveWorkflowConnection;
  onAdvanceTask: (taskId: string) => Promise<void>;
};

type UseSddWorkflowResult = {
  workflowFeatureId: string;
  workflowGoal: string;
  workflowStep: SddStep;
  workflowCommand: string;
  workflowRunId: string | null;
  workflowStatus: 'idle' | 'running' | 'completed' | 'failed' | 'canceled';
  workflowStatusLabel: string;
  workflowEvents: SddRunEvent[];
  visibleWorkflowEvents: SddRunEvent[];
  workflowProposal: Proposal | null;
  workflowError: string | null;
  isStartingWorkflow: boolean;
  isApplyingProposal: boolean;
  workflowSupported: boolean;
  onWorkflowFeatureIdChange: (value: string) => void;
  onWorkflowGoalChange: (value: string) => void;
  onWorkflowStepChange: (value: SddStep) => void;
  onWorkflowCommandChange: (value: string) => void;
  onWorkflowStart: () => Promise<void>;
  onWorkflowCancel: () => Promise<void>;
  onWorkflowApplyProposal: () => Promise<void>;
};

export function useSddWorkflow({
  enabled,
  selectedFeatureId,
  selectedTaskId,
  tasks,
  customCommands,
  requestSecretAccess,
  resolveWorkflowConnection,
  onAdvanceTask,
}: UseSddWorkflowParams): UseSddWorkflowResult {
  const [workflowFeatureId, setWorkflowFeatureId] = useState('');
  const [workflowGoal, setWorkflowGoal] = useState('');
  const [workflowStep, setWorkflowStep] = useState<SddStep>('spec');
  const [workflowCommand, setWorkflowCommand] = useState('');
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<
    'idle' | 'running' | 'completed' | 'failed' | 'canceled'
  >('idle');
  const [workflowEvents, setWorkflowEvents] = useState<SddRunEvent[]>([]);
  const [workflowProposal, setWorkflowProposal] = useState<Proposal | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [isApplyingProposal, setIsApplyingProposal] = useState(false);

  const workflowRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    workflowRunIdRef.current = workflowRunId;
  }, [workflowRunId]);

  useEffect(() => {
    if (!selectedFeatureId) {
      return;
    }
    setWorkflowFeatureId((current) => (current.length === 0 ? selectedFeatureId : current));
  }, [selectedFeatureId]);

  useEffect(() => {
    if (!enabled || typeof window.api?.sddRuns?.onEvent !== 'function') {
      return;
    }

    const unsubscribe = window.api.sddRuns.onEvent((event) => {
      const currentRunId = workflowRunIdRef.current;
      if (event.type === 'started') {
        setWorkflowRunId(event.runId);
        setWorkflowStatus('running');
        setWorkflowStep(event.step);
        setWorkflowFeatureId(event.featureId);
        setWorkflowGoal(event.goal);
        setWorkflowProposal(null);
        setWorkflowError(null);
        setWorkflowEvents([event]);
        return;
      }

      if (currentRunId && event.runId !== currentRunId) {
        return;
      }

      setWorkflowEvents((prev) => [...prev, event].slice(-200));

      if (event.type === 'stepStarted') {
        setWorkflowStep(event.step);
      }
      if (event.type === 'proposalReady' || event.type === 'approvalRequired') {
        setWorkflowProposal(event.proposal);
      }
      if (event.type === 'proposalApplied') {
        setWorkflowProposal(null);
      }
      if (event.type === 'runCompleted') {
        setWorkflowStatus('completed');
      }
      if (event.type === 'runFailed') {
        setWorkflowStatus('failed');
        setWorkflowError(event.message);
      }
      if (event.type === 'runCanceled') {
        setWorkflowStatus('canceled');
        setWorkflowError(event.message ?? 'Run canceled.');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [enabled]);

  const handleStartWorkflow = async () => {
    if (typeof window.api?.sddRuns?.start !== 'function') {
      return;
    }
    const hasSlashCommand = workflowCommand.trim().startsWith('/');
    const parsedCommand = parseSlashCommand(workflowCommand, customCommands);
    if (hasSlashCommand && !parsedCommand) {
      setWorkflowError('Unknown slash command. Check Settings > SDD custom commands.');
      return;
    }

    const step = parsedCommand?.step ?? workflowStep;
    const resolvedGoal = parsedCommand?.goalTemplate
      ? applyGoalTemplate(parsedCommand.goalTemplate, {
          input: parsedCommand.input,
          featureId: workflowFeatureId.trim(),
          taskId: selectedTaskId ?? '',
        })
      : workflowGoal.trim().length === 0 && parsedCommand?.input
      ? parsedCommand.input
      : workflowGoal;

    if (!workflowFeatureId.trim() || !resolvedGoal.trim()) {
      setWorkflowError('Feature ID and goal are required to start an SDD run.');
      return;
    }

    setWorkflowError(null);
    setIsStartingWorkflow(true);
    try {
      const { connectionId, connections, settings } = await resolveWorkflowConnection();
      if (!connectionId) {
        setWorkflowError(
          describeMissingConnection({
            connections,
            settings,
            explicitConnectionId: null,
          })
        );
        return;
      }

      const access = await requestSecretAccess({
        connectionId,
        requesterId: 'agent-host',
        reason: 'sdd.run',
      });
      if (!access.granted) {
        setWorkflowError('Secret access denied for this connection.');
        return;
      }

      await window.api.sddRuns.start({
        featureId: workflowFeatureId.trim(),
        goal: resolvedGoal.trim(),
        step,
        connectionId,
      });
    } catch (runError) {
      console.error('Failed to start SDD workflow run:', runError);
      setWorkflowError(
        runError instanceof Error ? runError.message : 'Failed to start SDD workflow run.'
      );
    } finally {
      setIsStartingWorkflow(false);
    }
  };

  const handleCancelWorkflow = async () => {
    if (!workflowRunId || typeof window.api?.sddRuns?.control !== 'function') {
      return;
    }
    setWorkflowError(null);
    try {
      await window.api.sddRuns.control({
        runId: workflowRunId,
        action: 'cancel',
        reason: 'User canceled workflow run.',
      });
    } catch (controlError) {
      console.error('Failed to cancel SDD workflow run:', controlError);
      setWorkflowError(
        controlError instanceof Error ? controlError.message : 'Failed to cancel SDD workflow run.'
      );
    }
  };

  const handleApplyProposal = async () => {
    if (
      !workflowRunId ||
      !workflowProposal ||
      typeof window.api?.sddRuns?.applyProposal !== 'function'
    ) {
      return;
    }
    setWorkflowError(null);
    setIsApplyingProposal(true);
    try {
      await window.api.sddRuns.applyProposal({
        runId: workflowRunId,
        proposal: workflowProposal,
      });
      if (workflowStep === 'implement') {
        const nextTaskId = getNextTaskId(tasks, selectedTaskId);
        if (nextTaskId) {
          await onAdvanceTask(nextTaskId);
        }
      }
    } catch (applyError) {
      console.error('Failed to apply SDD proposal:', applyError);
      setWorkflowError(
        applyError instanceof Error ? applyError.message : 'Failed to apply SDD proposal.'
      );
    } finally {
      setIsApplyingProposal(false);
    }
  };

  const workflowStatusLabel =
    workflowStatus === 'running'
      ? 'Running'
      : workflowStatus === 'failed'
      ? 'Failed'
      : workflowStatus === 'canceled'
      ? 'Canceled'
      : workflowStatus === 'completed'
      ? 'Completed'
      : 'Idle';
  const workflowSupported = typeof window.api?.sddRuns?.start === 'function';
  const visibleWorkflowEvents = workflowEvents.slice(-12);

  return {
    workflowFeatureId,
    workflowGoal,
    workflowStep,
    workflowCommand,
    workflowRunId,
    workflowStatus,
    workflowStatusLabel,
    workflowEvents,
    visibleWorkflowEvents,
    workflowProposal,
    workflowError,
    isStartingWorkflow,
    isApplyingProposal,
    workflowSupported,
    onWorkflowFeatureIdChange: setWorkflowFeatureId,
    onWorkflowGoalChange: setWorkflowGoal,
    onWorkflowStepChange: setWorkflowStep,
    onWorkflowCommandChange: setWorkflowCommand,
    onWorkflowStart: handleStartWorkflow,
    onWorkflowCancel: handleCancelWorkflow,
    onWorkflowApplyProposal: handleApplyProposal,
  };
}
