import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  SddDocRef,
  SddFeatureSummary,
  SddFileTraceResponse,
} from 'packages-api-contracts';
import { useFileTree } from '../explorer/FileTreeContext';
import { useSddStatus } from '../../hooks/useSddStatus';

type SddTaskItem = {
  id: string;
  label: string;
};

const buildWorkspacePath = (workspacePath: string, relativePath: string): string => {
  const separator = workspacePath.includes('\\') ? '\\' : '/';
  const trimmedRoot = workspacePath.replace(/[\\/]+$/, '');
  const trimmedRelative = relativePath.replace(/^[\\/]+/, '');
  return `${trimmedRoot}${separator}${trimmedRelative}`;
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

const hashContent = async (content: string): Promise<string> => {
  const data = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [isStoppingRun, setIsStoppingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRun = status?.activeRun ?? null;
  const parity = status?.parity;
  const trackedChanges = parity?.trackedFileChanges ?? 0;
  const untrackedChanges = parity?.untrackedFileChanges ?? 0;
  const trackedRatio = parity?.trackedRatio ?? 1;
  const driftFiles = parity?.driftFiles ?? [];
  const staleDocs = parity?.staleDocs ?? [];

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

  const buildDocRefs = useCallback(async (): Promise<SddDocRef[]> => {
    if (!workspace) {
      return [];
    }

    const candidatePaths: Array<string | undefined> = [
      buildWorkspacePath(workspace.path, 'memory/constitution.md'),
      selectedFeature?.specPath,
      selectedFeature?.planPath,
      selectedFeature?.tasksPath,
    ];

    const refs: SddDocRef[] = [];
    if (typeof window.api?.fs?.readFile !== 'function') {
      return refs;
    }

    for (const docPath of candidatePaths) {
      if (!docPath) {
        continue;
      }
      try {
        const response = await window.api.fs.readFile({ path: docPath });
        const hash = await hashContent(response.content ?? '');
        refs.push({ path: docPath, hash });
      } catch (docError) {
        console.error('Failed to read SDD doc:', docError);
      }
    }

    return refs;
  }, [selectedFeature, workspace]);

  const handleStartRun = async () => {
    if (!selectedFeatureId || !selectedTaskId || typeof window.api?.sdd?.startRun !== 'function') {
      return;
    }
    setError(null);
    setIsStartingRun(true);
    try {
      const inputs = await buildDocRefs();
      await window.api.sdd.startRun({
        featureId: selectedFeatureId,
        taskId: selectedTaskId,
        inputs,
      });
    } catch (runError) {
      console.error('Failed to start SDD run:', runError);
      setError(runError instanceof Error ? runError.message : 'Failed to start SDD run.');
    } finally {
      setIsStartingRun(false);
    }
  };

  const handleStopRun = async () => {
    if (typeof window.api?.sdd?.stopRun !== 'function') {
      return;
    }
    setError(null);
    setIsStoppingRun(true);
    try {
      await window.api.sdd.stopRun();
    } catch (runError) {
      console.error('Failed to stop SDD run:', runError);
      setError(runError instanceof Error ? runError.message : 'Failed to stop SDD run.');
    } finally {
      setIsStoppingRun(false);
    }
  };

  const handleOpenFile = (filePath: string) => {
    openFile(filePath);
  };

  if (!workspace) {
    return (
      <div className="flex flex-col h-full bg-surface">
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
      <div className="flex flex-col h-full bg-surface">
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
    <div className="flex flex-col h-full bg-surface">
      <div
        className="border-b border-border-subtle bg-surface-secondary"
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
            {activeRun ? 'Running' : 'Idle'}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div
            className="text-tertiary"
            style={{ fontSize: 'var(--vscode-font-size-small)' }}
          >
            {activeRun
              ? `Run: ${activeRun.featureId} / ${activeRun.taskId}`
              : 'No active run.'}
          </div>
          <div className="flex items-center gap-2">
            {!activeRun && (
              <button
                onClick={handleStartRun}
                disabled={!selectedFeatureId || !selectedTaskId || isStartingRun}
                className="
                  rounded-sm bg-accent text-primary
                  hover:bg-accent-hover active:opacity-90
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                "
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingTop: 'var(--vscode-space-2)',
                  paddingBottom: 'var(--vscode-space-2)',
                  fontSize: 'var(--vscode-font-size-ui)',
                }}
              >
                {isStartingRun ? 'Starting...' : 'Start Run'}
              </button>
            )}
            {activeRun && (
              <button
                onClick={handleStopRun}
                disabled={isStoppingRun}
                className="
                  rounded-sm border border-border-subtle text-secondary
                  hover:bg-surface-hover hover:text-primary
                  active:opacity-90 transition-colors duration-150
                "
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingTop: 'var(--vscode-space-2)',
                  paddingBottom: 'var(--vscode-space-2)',
                  fontSize: 'var(--vscode-font-size-ui)',
                }}
              >
                {isStoppingRun ? 'Stopping...' : 'Stop Run'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
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
