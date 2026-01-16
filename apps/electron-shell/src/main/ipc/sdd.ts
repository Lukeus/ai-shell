import { BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  IPC_CHANNELS,
  type Settings,
  SddListFeaturesRequestSchema,
  SddListFeaturesResponse,
  SddStatus,
  SddStatusSchema,
  SddStatusRequestSchema,
  SddStartRunRequestSchema,
  SddRun,
  SddStopRunRequestSchema,
  SddSetActiveTaskRequestSchema,
  SddGetFileTraceRequestSchema,
  SddFileTraceResponse,
  SddGetTaskTraceRequestSchema,
  SddTaskTraceResponse,
  SddGetParityRequestSchema,
  SddParity,
  SddOverrideUntrackedRequestSchema,
  SddProposalApplyRequestSchema,
  SddRunStartRequestSchema,
  SddRunControlRequestSchema,
} from 'packages-api-contracts';
import { sddTraceService } from '../services/SddTraceService';
import { sddWatcher } from '../services/SddWatcher';
import { workspaceService } from '../services/WorkspaceService';
import { resolvePathWithinWorkspace } from '../services/workspace-paths';
import { patchApplyService } from '../services/PatchApplyService';
import { auditService } from '../services/AuditService';
import { sddRunCoordinator } from '../services/SddRunCoordinator';
import { getAgentHostManager } from '../index';

let sddBindingsReady = false;

const publishSddStatus = (status: SddStatus): void => {
  let validated: SddStatus;
  try {
    validated = SddStatusSchema.parse(status);
  } catch {
    return;
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    const contents = window.webContents;
    if (contents.isDestroyed()) {
      continue;
    }
    try {
      contents.send(IPC_CHANNELS.SDD_CHANGED, validated);
    } catch {
      // Ignore send failures for closing windows.
    }
  }
};

const ensureSddBindings = (): void => {
  if (sddBindingsReady) {
    return;
  }

  sddTraceService.onStatusChange((status) => {
    publishSddStatus(status);
  });

  sddBindingsReady = true;
};

export const applySddSettings = async (settings: Settings): Promise<void> => {
  if (!settings.sdd.enabled) {
    sddWatcher.setEnabled(false);
    try {
      await sddTraceService.setEnabled(false);
    } catch {
      // Ignore failures when workspace is unavailable during shutdown.
    }
    return;
  }

  try {
    await sddTraceService.setEnabled(true);
  } catch {
    // Ignore failures to avoid blocking settings updates.
  }
  try {
    sddWatcher.setEnabled(true);
  } catch {
    // Ignore watcher startup failures when workspace is unavailable.
  }
};

const isFile = async (filePath: string): Promise<boolean> => {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
};

const listSddFeatures = async (): Promise<SddListFeaturesResponse> => {
  const workspace = workspaceService.getWorkspace();
  if (!workspace) {
    return [];
  }

  const specsRoot = path.join(workspace.path, 'specs');
  if (!fs.existsSync(specsRoot)) {
    return [];
  }

  let dirents: fs.Dirent[];
  try {
    dirents = await fs.promises.readdir(specsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const features: SddListFeaturesResponse = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const featureId = dirent.name;
    const featureRoot = path.join(specsRoot, featureId);
    const specCandidate = path.join(featureRoot, 'spec.md');

    if (!(await isFile(specCandidate))) {
      continue;
    }

    let specPath: string;
    try {
      specPath = await resolvePathWithinWorkspace(specCandidate, workspace.path);
    } catch {
      continue;
    }

    const summary: SddListFeaturesResponse[number] = {
      featureId,
      specPath,
    };

    const planCandidate = path.join(featureRoot, 'plan.md');
    if (await isFile(planCandidate)) {
      try {
        summary.planPath = await resolvePathWithinWorkspace(planCandidate, workspace.path);
      } catch {
        // Ignore invalid plan path.
      }
    }

    const tasksCandidate = path.join(featureRoot, 'tasks.md');
    if (await isFile(tasksCandidate)) {
      try {
        summary.tasksPath = await resolvePathWithinWorkspace(tasksCandidate, workspace.path);
      } catch {
        // Ignore invalid tasks path.
      }
    }

    features.push(summary);
  }

  features.sort((a, b) => a.featureId.localeCompare(b.featureId));
  return features;
};

export const registerSddHandlers = (): void => {
  ensureSddBindings();

  ipcMain.handle(
    IPC_CHANNELS.SDD_LIST_FEATURES,
    async (_event, request: unknown): Promise<SddListFeaturesResponse> => {
      SddListFeaturesRequestSchema.parse(request ?? {});
      return await listSddFeatures();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_STATUS,
    async (_event, request: unknown): Promise<SddStatus> => {
      SddStatusRequestSchema.parse(request ?? {});
      return await sddTraceService.getStatus();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_START_RUN,
    async (_event, request: unknown): Promise<SddRun> => {
      const validated = SddStartRunRequestSchema.parse(request);
      return await sddTraceService.startRun(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_STOP_RUN,
    async (_event, request: unknown): Promise<void> => {
      SddStopRunRequestSchema.parse(request ?? {});
      await sddTraceService.stopRun();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_SET_ACTIVE_TASK,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddSetActiveTaskRequestSchema.parse(request);
      sddTraceService.setActiveTask(validated.featureId, validated.taskId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_GET_FILE_TRACE,
    async (_event, request: unknown): Promise<SddFileTraceResponse> => {
      const validated = SddGetFileTraceRequestSchema.parse(request);
      return await sddTraceService.getFileTrace(validated.path);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_GET_TASK_TRACE,
    async (_event, request: unknown): Promise<SddTaskTraceResponse> => {
      const validated = SddGetTaskTraceRequestSchema.parse(request);
      return await sddTraceService.getTaskTrace(validated.featureId, validated.taskId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_GET_PARITY,
    async (_event, request: unknown): Promise<SddParity> => {
      SddGetParityRequestSchema.parse(request ?? {});
      return await sddTraceService.getParity();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_OVERRIDE_UNTRACKED,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddOverrideUntrackedRequestSchema.parse(request);
      await sddTraceService.overrideUntracked(validated.reason);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_RUNS_START,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddRunStartRequestSchema.parse(request);
      sddRunCoordinator.attachAgentHost(getAgentHostManager());
      await sddRunCoordinator.startRun(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_RUNS_CONTROL,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddRunControlRequestSchema.parse(request);
      sddRunCoordinator.attachAgentHost(getAgentHostManager());
      await sddRunCoordinator.controlRun(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SDD_PROPOSAL_APPLY,
    async (_event, request: unknown): Promise<void> => {
      const validated = SddProposalApplyRequestSchema.parse(request);
      const workspace = workspaceService.getWorkspace();
      if (!workspace) {
        throw new Error('No workspace open. Open a folder first.');
      }

      try {
        const result = await patchApplyService.applyProposal(
          validated.proposal,
          workspace.path
        );
        auditService.logSddProposalApply({
          runId: validated.runId,
          status: 'success',
          filesChanged: result.summary.filesChanged,
          files: result.files,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply proposal';
        auditService.logSddProposalApply({
          runId: validated.runId,
          status: 'error',
          filesChanged: 0,
          error: message,
        });
        throw error;
      }
    }
  );
};
