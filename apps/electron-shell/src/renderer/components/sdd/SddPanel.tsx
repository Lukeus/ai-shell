import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SddFeatureSummary,
  SddFileTraceResponse,
  SddRunEvent,
  SddStep,
  Proposal,
} from 'packages-api-contracts';
import { useFileTree } from '../explorer/FileTreeContext';
import { useSddStatus } from '../../hooks/useSddStatus';
import { ProposalDiffView } from './ProposalDiffView';
import { SddRunControls } from './SddRunControls';

type SddTaskItem = {
  id: string;
  label: string;
};

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

const parseSlashCommand = (value: string): SddStep | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const [command] = trimmed.split(/\s+/, 1);
  if (command === '/spec') return 'spec';
  if (command === '/plan') return 'plan';
  if (command === '/tasks') return 'tasks';
  if (command === '/implement') return 'implement';
  if (command === '/review') return 'review';
  return null;
};

const formatEventLabel = (event: SddRunEvent): string => {
  switch (event.type) {
    case 'started':
      return `Started ${event.featureId} (${event.step})`;
    case 'contextLoaded':
      return 'Context loaded';
    case 'stepStarted':
      return `Step started: ${event.step}`;
    case 'outputAppended':
      return 'Output appended';
    case 'proposalReady':
      return 'Proposal ready';
    case 'approvalRequired':
      return 'Approval required';
    case 'proposalApplied':
      return 'Proposal applied';
    case 'testsRequested':
      return `Tests requested: ${event.command}`;
    case 'testsCompleted':
      return `Tests completed (${event.exitCode})`;
    case 'runCompleted':
      return 'Run completed';
    case 'runFailed':
      return `Run failed: ${event.message}`;
    default:
      return event.type;
  }
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
    'idle' | 'running' | 'completed' | 'failed'
  >('idle');
  const [workflowEvents, setWorkflowEvents] = useState<SddRunEvent[]>([]);
  const [workflowProposal, setWorkflowProposal] = useState<Proposal | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [isApplyingProposal, setIsApplyingProposal] = useState(false);

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
        const response = await window.api.fs.readFile({ path: selectedFeature.tasksPath });
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
    const stepOverride = parseSlashCommand(workflowCommand);
    const step = stepOverride ?? workflowStep;
    if (!workflowFeatureId.trim() || !workflowGoal.trim()) {
      setWorkflowError('Feature ID and goal are required to start an SDD run.');
      return;
    }

    setWorkflowError(null);
    setIsStartingWorkflow(true);
    try {
      await window.api.sddRuns.start({
        featureId: workflowFeatureId.trim(),
        goal: workflowGoal.trim(),
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

  const workflowStatusLabel =
    workflowStatus === 'running'
      ? 'Running'
      : workflowStatus === 'failed'
      ? 'Failed'
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
      <div className="flex flex-col h-full min-h-0 bg-surface">
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
    <div className="flex flex-col h-full min-h-0 bg-surface">
      <div
        className="border-b border-border-subtle bg-surface-secondary shrink-0"
        style={{ padding: 'var(--vscode-space-3)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="codicon codicon-checklist text-secondary" aria-hidden="true" />
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Spec-driven development
            </span>
          </div>
          <span
            className="text-tertiary"
            style={{ fontSize: 'var(--vscode-font-size-small)' }}
          >
            Workflow: {workflowStatusLabel}
          </span>
        </div>

        <div
          className="mt-2 text-tertiary"
          style={{ fontSize: 'var(--vscode-font-size-small)' }}
        >
          {workflowRunId ? `Run ID: ${workflowRunId.slice(0, 8)}...` : 'No active workflow run.'}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
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

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Workflow
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {workflowStatusLabel}
            </span>
          </div>
          <div style={{ padding: 'var(--vscode-space-3)' }}>
            <SddRunControls
              featureId={workflowFeatureId}
              goal={workflowGoal}
              step={workflowStep}
              slashCommand={workflowCommand}
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
          </div>
        </div>

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Activity
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {workflowEvents.length}
            </span>
          </div>

          {visibleWorkflowEvents.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              No workflow events yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleWorkflowEvents.map((event) => (
                <div
                  key={event.id}
                  className="text-secondary"
                  style={{
                    paddingLeft: 'var(--vscode-space-3)',
                    paddingRight: 'var(--vscode-space-3)',
                    paddingTop: 'var(--vscode-space-2)',
                    paddingBottom: 'var(--vscode-space-2)',
                    fontSize: 'var(--vscode-font-size-small)',
                    borderTop: '1px solid var(--vscode-border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-primary">{formatEventLabel(event)}</span>
                    <span className="text-tertiary">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.type === 'outputAppended' && (
                    <div className="text-tertiary" style={{ marginTop: 'var(--vscode-space-1)' }}>
                      {event.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {workflowProposal && (
          <div className="border-b border-border-subtle">
            <div
              className="flex items-center justify-between text-secondary"
              style={{ padding: 'var(--vscode-space-2)' }}
            >
              <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
                Proposal
              </span>
              <span
                className="text-tertiary"
                style={{ fontSize: 'var(--vscode-font-size-small)' }}
              >
                {workflowProposal.summary.filesChanged} files
              </span>
            </div>
            <div style={{ padding: 'var(--vscode-space-3)' }}>
              <ProposalDiffView
                proposal={workflowProposal}
                onApply={handleApplyProposal}
                isApplying={isApplyingProposal}
                canApply={Boolean(workflowRunId)}
              />
            </div>
          </div>
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

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Features
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {features.length}
            </span>
          </div>

          {isLoadingFeatures ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              Loading specs...
            </div>
          ) : features.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              No specs detected.
            </div>
          ) : (
            <div className="flex flex-col">
              {features.map((feature) => {
                const isSelected = feature.featureId === selectedFeatureId;
                return (
                  <button
                    key={feature.featureId}
                    onClick={() => handleSelectFeature(feature.featureId)}
                    className={`
                      text-left hover:bg-surface-hover
                      transition-colors duration-150
                      ${isSelected ? 'bg-surface-hover text-primary' : 'text-secondary'}
                    `}
                    style={{
                      paddingLeft: 'var(--vscode-space-3)',
                      paddingRight: 'var(--vscode-space-3)',
                      paddingTop: 'var(--vscode-space-2)',
                      paddingBottom: 'var(--vscode-space-2)',
                      fontSize: 'var(--vscode-font-size-ui)',
                    }}
                  >
                    {feature.featureId}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Tasks
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {tasks.length}
            </span>
          </div>

          {isLoadingTasks ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              {selectedFeature ? 'No tasks found.' : 'Select a feature to view tasks.'}
            </div>
          ) : (
            <div className="flex flex-col">
              {tasks.map((task) => {
                const isSelected = task.id === selectedTaskId;
                return (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task.id)}
                    className={`
                      text-left hover:bg-surface-hover
                      transition-colors duration-150
                      ${isSelected ? 'bg-surface-hover text-primary' : 'text-secondary'}
                    `}
                    style={{
                      paddingLeft: 'var(--vscode-space-3)',
                      paddingRight: 'var(--vscode-space-3)',
                      paddingTop: 'var(--vscode-space-2)',
                      paddingBottom: 'var(--vscode-space-2)',
                      fontSize: 'var(--vscode-font-size-small)',
                    }}
                  >
                    {task.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Parity
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {Math.round(trackedRatio * 100)}%
            </span>
          </div>
          <div
            className="flex flex-col gap-2"
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingBottom: 'var(--vscode-space-3)',
            }}
          >
            <div
              className="h-2 w-full rounded-full bg-surface-elevated overflow-hidden"
              aria-hidden="true"
            >
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.round(trackedRatio * 100)}%` }}
              />
            </div>
            <div
              className="flex items-center justify-between text-tertiary"
              style={{ fontSize: 'var(--vscode-font-size-small)' }}
            >
              <span>Tracked: {trackedChanges}</span>
              <span>Untracked: {untrackedChanges}</span>
            </div>
          </div>
        </div>

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Drift Files
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {driftFiles.length}
            </span>
          </div>
          {driftFiles.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              No untracked changes detected.
            </div>
          ) : (
            <div className="flex flex-col">
              {driftFiles.map((filePath) => (
                <button
                  key={filePath}
                  onClick={() => handleOpenFile(filePath)}
                  className="text-left hover:bg-surface-hover text-secondary"
                  style={{
                    paddingLeft: 'var(--vscode-space-3)',
                    paddingRight: 'var(--vscode-space-3)',
                    paddingTop: 'var(--vscode-space-2)',
                    paddingBottom: 'var(--vscode-space-2)',
                    fontSize: 'var(--vscode-font-size-small)',
                  }}
                >
                  {formatPath(filePath)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-border-subtle">
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Stale Docs
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {staleDocs.length}
            </span>
          </div>
          {staleDocs.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              No stale docs detected.
            </div>
          ) : (
            <div className="flex flex-col">
              {staleDocs.map((filePath) => (
                <button
                  key={filePath}
                  onClick={() => handleOpenFile(filePath)}
                  className="text-left hover:bg-surface-hover text-secondary"
                  style={{
                    paddingLeft: 'var(--vscode-space-3)',
                    paddingRight: 'var(--vscode-space-3)',
                    paddingTop: 'var(--vscode-space-2)',
                    paddingBottom: 'var(--vscode-space-2)',
                    fontSize: 'var(--vscode-font-size-small)',
                  }}
                >
                  {formatPath(filePath)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div
            className="flex items-center justify-between text-secondary"
            style={{ padding: 'var(--vscode-space-2)' }}
          >
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              File Trace
            </span>
            <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              {fileTrace?.runs.length ?? 0}
            </span>
          </div>
          {!selectedEntry || selectedEntry.type !== 'file' ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              Select a file to view trace details.
            </div>
          ) : !fileTrace || fileTrace.runs.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              No trace recorded for this file.
            </div>
          ) : (
            <div className="flex flex-col">
              {fileTrace.runs.map((run) => (
                <div
                  key={run.runId}
                  className="flex items-center justify-between text-secondary"
                  style={{
                    paddingLeft: 'var(--vscode-space-3)',
                    paddingRight: 'var(--vscode-space-3)',
                    paddingTop: 'var(--vscode-space-2)',
                    paddingBottom: 'var(--vscode-space-2)',
                    fontSize: 'var(--vscode-font-size-small)',
                  }}
                >
                  <span className="text-primary">{`${run.featureId} / ${run.taskId}`}</span>
                  <span className="text-tertiary">{run.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
