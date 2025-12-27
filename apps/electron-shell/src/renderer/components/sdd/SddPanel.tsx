import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SddFeatureSummary,
  SddFileTraceResponse,
  SddRunEvent,
  SddStep,
  Proposal,
  SddCustomCommand,
} from 'packages-api-contracts';
import { useFileTree } from '../explorer/FileTreeContext';
import { useSddStatus } from '../../hooks/useSddStatus';
import { SddPanelHeader } from './SddPanelHeader';
import { SddWorkflowSection } from './SddWorkflowSection';
import { SddActivitySection } from './SddActivitySection';
import { SddProposalSection } from './SddProposalSection';
import { SddFeatureListSection } from './SddFeatureListSection';
import { SddTaskListSection, type SddTaskItem } from './SddTaskListSection';
import { SddParitySection } from './SddParitySection';
import { SddFileListSection } from './SddFileListSection';
import { SddFileTraceSection } from './SddFileTraceSection';

const parseTasks = (content: string): SddTaskItem[] => {
  const tasks: SddTaskItem[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('## ')) {
      continue;
    }
    const heading = line.replace(/^##\s+/, '').trim();
    if (!heading) {
      continue;
    }
    const match = heading.match(/^(Task\s+\d+)(?:\s*[-:]\s*(.+))?$/i);
    if (match) {
      const label = match[2] ? `${match[1]}: ${match[2]}` : match[1];
      tasks.push({ id: heading, label });
      continue;
    }
    tasks.push({ id: heading, label: heading });
  }
  return tasks;
};

type CustomSlashCommand = {
  command: string;
  step: SddStep;
  label?: string;
  goalTemplate?: string;
};

type ParsedSlashCommand = {
  command: string;
  step: SddStep;
  input: string;
  goalTemplate?: string;
};

const BUILTIN_SLASH_COMMANDS: Record<string, SddStep> = {
  '/spec': 'spec',
  '/plan': 'plan',
  '/tasks': 'tasks',
  '/implement': 'implement',
  '/review': 'review',
};

const validateCustomCommands = (
  commands: SddCustomCommand[]
): { commands: CustomSlashCommand[]; errors: string[] } => {
  const errors: string[] = [];
  const normalized = new Set<string>();
  const validated: CustomSlashCommand[] = [];

  for (const command of commands) {
    const normalizedCommand = command.command.trim().toLowerCase();
    if (!normalizedCommand.startsWith('/')) {
      errors.push(`Custom command "${command.command}" must start with "/".`);
      continue;
    }
    if (BUILTIN_SLASH_COMMANDS[normalizedCommand]) {
      errors.push(`Custom command "${normalizedCommand}" conflicts with a built-in command.`);
      continue;
    }
    if (normalized.has(normalizedCommand)) {
      errors.push(`Custom command "${normalizedCommand}" is defined more than once.`);
      continue;
    }
    normalized.add(normalizedCommand);
    validated.push({
      command: normalizedCommand,
      step: command.step,
      label: command.label,
      goalTemplate: command.goalTemplate,
    });
  }

  return { commands: validated, errors };
};

const parseSlashCommand = (
  value: string,
  customCommands: CustomSlashCommand[]
): ParsedSlashCommand | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const parts = trimmed.split(/\s+/);
  const rawCommand = parts[0] ?? '';
  const command = rawCommand.toLowerCase();
  const input = trimmed.slice(rawCommand.length).trim();

  const builtin = BUILTIN_SLASH_COMMANDS[command];
  if (builtin) {
    return { command, step: builtin, input };
  }

  const custom = customCommands.find((entry) => entry.command === command);
  if (!custom) {
    return null;
  }

  return {
    command,
    step: custom.step,
    input,
    goalTemplate: custom.goalTemplate,
  };
};

const applyGoalTemplate = (
  template: string,
  values: { input: string; featureId: string; taskId: string }
): string =>
  template
    .replace(/{{\s*input\s*}}/gi, values.input)
    .replace(/{{\s*featureId\s*}}/gi, values.featureId)
    .replace(/{{\s*taskId\s*}}/gi, values.taskId)
    .trim();

const getNextTaskId = (tasks: SddTaskItem[], currentTaskId: string | null): string | null => {
  if (!currentTaskId) {
    return null;
  }
  const currentIndex = tasks.findIndex((task) => task.id === currentTaskId);
  if (currentIndex < 0 || currentIndex >= tasks.length - 1) {
    return null;
  }
  return tasks[currentIndex + 1]?.id ?? null;
};


export function SddPanel() {
  const { workspace, openFile, selectedEntry } = useFileTree();
  const { enabled, status } = useSddStatus(workspace?.path);
  const [features, setFeatures] = useState<SddFeatureSummary[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<SddTaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [fileTrace, setFileTrace] = useState<SddFileTraceResponse | null>(null);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [customCommands, setCustomCommands] = useState<CustomSlashCommand[]>([]);
  const [customCommandErrors, setCustomCommandErrors] = useState<string[]>([]);

  const activeRun = status?.activeRun ?? null;
  const workflowRunIdRef = useRef<string | null>(null);
  const parity = status?.parity;
  const trackedChanges = parity?.trackedFileChanges ?? 0;
  const untrackedChanges = parity?.untrackedFileChanges ?? 0;
  const trackedRatio = parity?.trackedRatio ?? 1;
  const driftFiles = parity?.driftFiles ?? [];
  const staleDocs = parity?.staleDocs ?? [];

  useEffect(() => {
    workflowRunIdRef.current = workflowRunId;
  }, [workflowRunId]);

  const selectedFeature = useMemo(
    () => features.find((feature) => feature.featureId === selectedFeatureId) ?? null,
    [features, selectedFeatureId]
  );

  const formatPath = useCallback(
    (filePath: string) => {
      if (!workspace) {
        return filePath;
      }
      const normalizedFile = filePath.replace(/\\/g, '/');
      const normalizedRoot = workspace.path.replace(/\\/g, '/');
      if (normalizedFile.startsWith(normalizedRoot)) {
        const relative = normalizedFile.slice(normalizedRoot.length).replace(/^\/+/, '');
        return relative || normalizedFile;
      }
      return filePath;
    },
    [workspace]
  );

  useEffect(() => {
    if (!workspace) {
      setFeatures([]);
      setSelectedFeatureId(null);
      setTasks([]);
      setSelectedTaskId(null);
      setFileTrace(null);
      return;
    }

    if (!enabled || typeof window.api?.sdd?.listFeatures !== 'function') {
      setFeatures([]);
      return;
    }

    let isMounted = true;
    const loadFeatures = async () => {
      setIsLoadingFeatures(true);
      setError(null);
      try {
        const response = await window.api.sdd.listFeatures();
        if (!isMounted) return;
        setFeatures(response);
      } catch (loadError) {
        console.error('Failed to load SDD features:', loadError);
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load SDD features.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingFeatures(false);
        }
      }
    };

    void loadFeatures();

    return () => {
      isMounted = false;
    };
  }, [workspace, enabled]);

  useEffect(() => {
    let isMounted = true;
    const settingsEventTarget = window as unknown as {
      addEventListener: (type: string, listener: (event: { detail?: unknown }) => void) => void;
      removeEventListener: (type: string, listener: (event: { detail?: unknown }) => void) => void;
    };

    const applyCommands = (commands: SddCustomCommand[]) => {
      const result = validateCustomCommands(commands);
      if (isMounted) {
        setCustomCommands(result.commands);
        setCustomCommandErrors(result.errors);
      }
    };

    const loadCommands = async () => {
      if (typeof window.api?.getSettings !== 'function') {
        return;
      }
      try {
        const settings = await window.api.getSettings();
        applyCommands(settings.sdd?.customCommands ?? []);
      } catch (loadError) {
        if (isMounted) {
          setCustomCommandErrors([
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load custom slash commands.',
          ]);
        }
      }
    };

    const handleSettingsUpdated = (event: { detail?: unknown }) => {
      const detail = event.detail as any;
      applyCommands(detail?.sdd?.customCommands ?? []);
    };

    void loadCommands();
    settingsEventTarget.addEventListener('ai-shell:settings-updated', handleSettingsUpdated);

    return () => {
      isMounted = false;
      settingsEventTarget.removeEventListener('ai-shell:settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (activeRun) {
      setSelectedFeatureId(activeRun.featureId);
      setSelectedTaskId(activeRun.taskId);
    }
  }, [activeRun]);

  useEffect(() => {
    if (selectedFeatureId || features.length === 0) {
      return;
    }
    setSelectedFeatureId(features[0].featureId);
  }, [features, selectedFeatureId]);

  useEffect(() => {
    if (selectedTaskId || tasks.length === 0) {
      return;
    }
    setSelectedTaskId(tasks[0].id);
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    if (!selectedFeature?.tasksPath || typeof window.api?.fs?.readFile !== 'function') {
      setTasks([]);
      return;
    }

    let isMounted = true;
    const loadTasks = async () => {
      setIsLoadingTasks(true);
      setError(null);
      try {
        const response = await window.api.fs.readFile({ path: selectedFeature.tasksPath! });
        if (!isMounted) return;
        const parsed = parseTasks(response.content ?? '');
        setTasks(parsed);
      } catch (loadError) {
        console.error('Failed to load SDD tasks:', loadError);
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load SDD tasks.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingTasks(false);
        }
      }
    };

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, [selectedFeature]);

  useEffect(() => {
    const filePath = selectedEntry?.type === 'file' ? selectedEntry.path : null;
    if (!enabled || !filePath || typeof window.api?.sdd?.getFileTrace !== 'function') {
      setFileTrace(null);
      return;
    }

    let isMounted = true;
    const loadTrace = async () => {
      try {
        const trace = await window.api.sdd.getFileTrace(filePath);
        if (isMounted) {
          setFileTrace(trace);
        }
      } catch (loadError) {
        console.error('Failed to load SDD file trace:', loadError);
        if (isMounted) {
          setFileTrace(null);
        }
      }
    };

    void loadTrace();

    return () => {
      isMounted = false;
    };
  }, [
    enabled,
    selectedEntry?.path,
    selectedEntry?.type,
    parity?.trackedFileChanges,
    parity?.untrackedFileChanges,
  ]);

  const handleSelectFeature = (featureId: string) => {
    setSelectedFeatureId(featureId);
    setSelectedTaskId(null);
  };

  const handleSelectTask = async (taskId: string) => {
    setSelectedTaskId(taskId);
    if (selectedFeatureId && typeof window.api?.sdd?.setActiveTask === 'function') {
      try {
        await window.api.sdd.setActiveTask(selectedFeatureId, taskId);
      } catch (taskError) {
        console.error('Failed to set active SDD task:', taskError);
      }
    }
  };

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
      await window.api.sddRuns.start({
        featureId: workflowFeatureId.trim(),
        goal: resolvedGoal.trim(),
        step,
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
          await handleSelectTask(nextTaskId);
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

  const handleOpenFile = (filePath: string) => {
    openFile(filePath);
  };

  const handleReconcileDrift = useCallback(async (reason: string) => {
    if (typeof window.api?.sdd?.overrideUntracked !== 'function') {
      throw new Error('SDD drift reconciliation is unavailable in this build.');
    }
    await window.api.sdd.overrideUntracked(reason);
  }, []);

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

  if (!workspace) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-surface">
        <div
          className="flex items-center justify-center flex-1 text-center text-secondary animate-fade-in"
          style={{
            paddingLeft: 'var(--vscode-space-4)',
            paddingRight: 'var(--vscode-space-4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="codicon codicon-checklist text-2xl opacity-50" aria-hidden="true" />
            <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              Open a workspace to view SDD.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex flex-col h-full w-full min-h-0 bg-surface">
        <div
          className="flex items-center justify-center flex-1 text-center text-secondary animate-fade-in"
          style={{
            paddingLeft: 'var(--vscode-space-4)',
            paddingRight: 'var(--vscode-space-4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="codicon codicon-shield text-2xl opacity-50" aria-hidden="true" />
            <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              SDD is disabled. Enable it in Settings to start tracing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-surface">
      <SddPanelHeader
        workflowStatusLabel={workflowStatusLabel}
        workflowRunId={workflowRunId}
      />

      <div className="flex-1 min-h-0 overflow-auto w-full">
        {workflowError && (
          <div
            className="text-status-error"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {workflowError}
          </div>
        )}

        {!workflowSupported && (
          <div
            className="text-tertiary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            SDD workflow is unavailable in this build.
          </div>
        )}

        <SddWorkflowSection
          workflowStatusLabel={workflowStatusLabel}
          workflowFeatureId={workflowFeatureId}
          workflowGoal={workflowGoal}
          workflowStep={workflowStep}
          workflowCommand={workflowCommand}
          customCommands={customCommands.map((command) => command.command)}
          customCommandErrors={customCommandErrors}
          isRunning={workflowStatus === 'running'}
          isStarting={isStartingWorkflow}
          canStart={workflowSupported}
          onFeatureIdChange={setWorkflowFeatureId}
          onGoalChange={setWorkflowGoal}
          onStepChange={setWorkflowStep}
          onSlashCommandChange={setWorkflowCommand}
          onStart={handleStartWorkflow}
          onCancel={handleCancelWorkflow}
        />

        <SddActivitySection
          events={visibleWorkflowEvents}
          totalCount={workflowEvents.length}
        />

        {workflowProposal && (
          <SddProposalSection
            proposal={workflowProposal}
            runId={workflowRunId}
            onApply={handleApplyProposal}
            isApplying={isApplyingProposal}
          />
        )}

        {error && (
          <div
            className="text-status-error"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {error}
          </div>
        )}

        <SddFeatureListSection
          features={features}
          selectedFeatureId={selectedFeatureId}
          isLoading={isLoadingFeatures}
          onSelect={handleSelectFeature}
        />

        <SddTaskListSection
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          isLoading={isLoadingTasks}
          hasFeature={Boolean(selectedFeature)}
          onSelect={handleSelectTask}
        />

        <SddParitySection
          trackedRatio={trackedRatio}
          trackedChanges={trackedChanges}
          untrackedChanges={untrackedChanges}
          driftFilesCount={driftFiles.length}
          staleDocsCount={staleDocs.length}
          onReconcile={handleReconcileDrift}
        />

        <SddFileListSection
          title="Drift Files"
          files={driftFiles}
          emptyText="No untracked changes detected."
          onOpenFile={handleOpenFile}
          formatPath={formatPath}
        />

        <SddFileListSection
          title="Stale Docs"
          files={staleDocs}
          emptyText="No stale docs detected."
          onOpenFile={handleOpenFile}
          formatPath={formatPath}
        />

        <SddFileTraceSection selectedEntry={selectedEntry} fileTrace={fileTrace} />
      </div>
    </div>
  );
}
