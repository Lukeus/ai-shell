import type {
  Proposal,
  SddFeatureSummary,
  SddFileTraceResponse,
  SddRunEvent,
  SddStep,
} from 'packages-api-contracts';
import type { FileTreeContextValue } from '../explorer/FileTreeContext';
import type { SddTaskItem } from './SddTaskListSection';

export type SddPanelWorkflowState = {
  featureId: string;
  goal: string;
  step: SddStep;
  command: string;
  customCommands: string[];
  customCommandErrors: string[];
  isRunning: boolean;
  isStarting: boolean;
  proposal: Proposal | null;
  isApplying: boolean;
};

export type SddPanelActivityState = {
  events: SddRunEvent[];
  totalCount: number;
};

export type SddPanelFeaturesState = {
  items: SddFeatureSummary[];
  selectedId: string | null;
  isLoading: boolean;
};

export type SddPanelTasksState = {
  items: SddTaskItem[];
  selectedId: string | null;
  isLoading: boolean;
  hasFeature: boolean;
};

export type SddPanelParityState = {
  trackedRatio: number;
  trackedChanges: number;
  untrackedChanges: number;
  driftFiles: string[];
  staleDocs: string[];
};

export type SddPanelFileTraceState = {
  selectedEntry: FileTreeContextValue['selectedEntry'];
  trace: SddFileTraceResponse | null;
};

export type SddPanelViewState = {
  hasWorkspace: boolean;
  enabled: boolean;
  workflowStatusLabel: string;
  workflowRunId: string | null;
  workflowError: string | null;
  workflowSupported: boolean;
  workflow: SddPanelWorkflowState;
  activity: SddPanelActivityState;
  features: SddPanelFeaturesState;
  tasks: SddPanelTasksState;
  parity: SddPanelParityState;
  fileTrace: SddPanelFileTraceState;
  error: string | null;
};

export type SddPanelViewActions = {
  onWorkflowFeatureIdChange: (value: string) => void;
  onWorkflowGoalChange: (value: string) => void;
  onWorkflowStepChange: (value: SddStep) => void;
  onWorkflowCommandChange: (value: string) => void;
  onWorkflowStart: () => void;
  onWorkflowCancel: () => void;
  onWorkflowApplyProposal: () => void;
  onSelectFeature: (featureId: string) => void;
  onSelectTask: (taskId: string) => void;
  onOpenFile: (path: string) => void;
  onReconcileDrift: (reason: string) => Promise<void>;
  formatPath: (path: string) => string;
};

export type SddPanelViewProps = {
  state: SddPanelViewState;
  actions: SddPanelViewActions;
};
