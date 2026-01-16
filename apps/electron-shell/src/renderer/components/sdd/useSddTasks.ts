import { useEffect, useState } from 'react';
import type { SddFeatureSummary } from 'packages-api-contracts';
import type { SddTaskItem } from './SddTaskListSection';
import { parseTasks } from './SddPanel.utils';

type UseSddTasksParams = {
  selectedFeature: SddFeatureSummary | null;
  selectedFeatureId: string | null;
  activeTaskId: string | null;
  setError: (message: string | null) => void;
};

type UseSddTasksResult = {
  tasks: SddTaskItem[];
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  isLoadingTasks: boolean;
  handleSelectTask: (taskId: string) => Promise<void>;
};

export function useSddTasks({
  selectedFeature,
  selectedFeatureId,
  activeTaskId,
  setError,
}: UseSddTasksParams): UseSddTasksResult {
  const [tasks, setTasks] = useState<SddTaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    if (activeTaskId) {
      setSelectedTaskId(activeTaskId);
    }
  }, [activeTaskId]);

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
  }, [selectedFeature, setError]);

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

  return {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    isLoadingTasks,
    handleSelectTask,
  };
}
