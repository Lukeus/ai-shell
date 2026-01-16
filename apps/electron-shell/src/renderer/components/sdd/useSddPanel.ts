import { useCallback, useEffect, useState } from 'react';
import { useConnectionsContext } from '../../contexts/ConnectionsContext';
import { useSddStatus } from '../../hooks/useSddStatus';
import { resolveAgentConnection } from '../../utils/agentConnections';
import { useFileTree } from '../explorer/FileTreeContext';
import type { SddPanelViewProps } from './SddPanel.types';
import { useSddCustomCommands } from './useSddCustomCommands';
import { useSddFeatures } from './useSddFeatures';
import { useSddFileTrace } from './useSddFileTrace';
import { useSddTasks } from './useSddTasks';
import { useSddWorkflow } from './useSddWorkflow';

export function useSddPanel(): SddPanelViewProps {
  const { workspace, openFile, selectedEntry } = useFileTree();
  const { requestSecretAccess } = useConnectionsContext();
  const { enabled, status } = useSddStatus(workspace?.path);
  const [error, setError] = useState<string | null>(null);

  const activeRun = status?.activeRun ?? null;
  const parity = status?.parity;
  const trackedChanges = parity?.trackedFileChanges ?? 0;
  const untrackedChanges = parity?.untrackedFileChanges ?? 0;
  const trackedRatio = parity?.trackedRatio ?? 1;
  const driftFiles = parity?.driftFiles ?? [];
  const staleDocs = parity?.staleDocs ?? [];

  const {
    features,
    selectedFeature,
    selectedFeatureId,
    setSelectedFeatureId,
    isLoadingFeatures,
  } = useSddFeatures({
    workspacePath: workspace?.path,
    enabled,
    activeFeatureId: activeRun?.featureId ?? null,
    setError,
  });

  const {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    isLoadingTasks,
    handleSelectTask,
  } = useSddTasks({
    selectedFeature,
    selectedFeatureId,
    activeTaskId: activeRun?.taskId ?? null,
    setError,
  });

  const { fileTrace } = useSddFileTrace({
    enabled,
    selectedEntry,
    parity,
  });

  const { customCommands, customCommandErrors } = useSddCustomCommands();

  useEffect(() => {
    if (!workspace) {
      setSelectedTaskId(null);
    }
  }, [setSelectedTaskId, workspace]);

  const resolveWorkflowConnection = useCallback(async () => {
    const [connectionsResponse, settings] = await Promise.all([
      window.api.connections.list(),
      window.api.getSettings(),
    ]);
    const resolution = resolveAgentConnection({
      connections: connectionsResponse.connections,
      settings,
    });
    return {
      ...resolution,
      connections: connectionsResponse.connections,
      settings,
    };
  }, []);

  const workflow = useSddWorkflow({
    enabled,
    selectedFeatureId,
    selectedTaskId,
    tasks,
    customCommands,
    requestSecretAccess,
    resolveWorkflowConnection,
    onAdvanceTask: handleSelectTask,
  });

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

  const handleOpenFile = useCallback(
    (filePath: string) => {
      openFile(filePath);
    },
    [openFile]
  );

  const handleSelectFeature = useCallback(
    (featureId: string) => {
      setSelectedFeatureId(featureId);
      setSelectedTaskId(null);
    },
    [setSelectedFeatureId, setSelectedTaskId]
  );

  const handleReconcileDrift = useCallback(async (reason: string) => {
    if (typeof window.api?.sdd?.overrideUntracked !== 'function') {
      throw new Error('SDD drift reconciliation is unavailable in this build.');
    }
    await window.api.sdd.overrideUntracked(reason);
  }, []);

  return {
    state: {
      hasWorkspace: Boolean(workspace),
      enabled,
      workflowStatusLabel: workflow.workflowStatusLabel,
      workflowRunId: workflow.workflowRunId,
      workflowError: workflow.workflowError,
      workflowSupported: workflow.workflowSupported,
      workflow: {
        featureId: workflow.workflowFeatureId,
        goal: workflow.workflowGoal,
        step: workflow.workflowStep,
        command: workflow.workflowCommand,
        customCommands: customCommands.map((command) => command.command),
        customCommandErrors,
        isRunning: workflow.workflowStatus === 'running',
        isStarting: workflow.isStartingWorkflow,
        proposal: workflow.workflowProposal,
        isApplying: workflow.isApplyingProposal,
      },
      activity: {
        events: workflow.visibleWorkflowEvents,
        totalCount: workflow.workflowEvents.length,
      },
      features: {
        items: features,
        selectedId: selectedFeatureId,
        isLoading: isLoadingFeatures,
      },
      tasks: {
        items: tasks,
        selectedId: selectedTaskId,
        isLoading: isLoadingTasks,
        hasFeature: Boolean(selectedFeature),
      },
      parity: {
        trackedRatio,
        trackedChanges,
        untrackedChanges,
        driftFiles,
        staleDocs,
      },
      fileTrace: {
        selectedEntry,
        trace: fileTrace,
      },
      error,
    },
    actions: {
      onWorkflowFeatureIdChange: workflow.onWorkflowFeatureIdChange,
      onWorkflowGoalChange: workflow.onWorkflowGoalChange,
      onWorkflowStepChange: workflow.onWorkflowStepChange,
      onWorkflowCommandChange: workflow.onWorkflowCommandChange,
      onWorkflowStart: workflow.onWorkflowStart,
      onWorkflowCancel: workflow.onWorkflowCancel,
      onWorkflowApplyProposal: workflow.onWorkflowApplyProposal,
      onSelectFeature: handleSelectFeature,
      onSelectTask: handleSelectTask,
      onOpenFile: handleOpenFile,
      onReconcileDrift: handleReconcileDrift,
      formatPath,
    },
  };
}
