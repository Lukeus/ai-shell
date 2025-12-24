import { randomUUID } from 'crypto';
import { BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  SddRunEventSchema,
  type SddRunEvent,
  type SddRunStartRequest,
  type SddRunControlRequest,
  type SddStep,
  type Connection,
} from 'packages-api-contracts';
import type { AgentHostManager } from './agent-host-manager';
import { settingsService } from './SettingsService';
import { connectionsService } from './ConnectionsService';

type SddRunRecord = {
  runId: string;
  featureId: string;
  step: SddStep;
  status: 'running' | 'completed' | 'failed' | 'canceled';
  routing?: {
    connectionId: string;
    providerId: string;
    modelRef?: string;
  };
  createdAt: string;
  updatedAt: string;
};

const getConnectionModelRef = (connection: Connection): string | undefined => {
  const model = connection.config.model;
  return typeof model === 'string' ? model : undefined;
};

/**
 * SddRunCoordinator - coordinates SDD workflow runs between main and agent-host.
 *
 * Owns run metadata and relays workflow events to renderer (P1).
 */
export class SddRunCoordinator {
  private static instance: SddRunCoordinator | null = null;
  private readonly runs = new Map<string, SddRunRecord>();
  private agentHostManager: AgentHostManager | null = null;
  private agentHostUnsubscribers: Array<() => void> = [];

  public static getInstance(): SddRunCoordinator {
    if (!SddRunCoordinator.instance) {
      SddRunCoordinator.instance = new SddRunCoordinator();
    }
    return SddRunCoordinator.instance;
  }

  public attachAgentHost(manager: AgentHostManager | null): void {
    if (!manager || this.agentHostManager === manager) {
      return;
    }
    this.agentHostUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.agentHostUnsubscribers = [];
    this.agentHostManager = manager;
    this.agentHostUnsubscribers.push(
      manager.onSddEvent((event) => this.handleAgentEvent(event))
    );
    this.agentHostUnsubscribers.push(
      manager.onSddRunError((runId, message) => this.handleRunError(runId, message))
    );
  }

  public async startRun(request: SddRunStartRequest): Promise<void> {
    const runId = randomUUID();
    const step = request.step ?? 'spec';
    const routing = this.resolveRouting(request);
    const now = new Date().toISOString();

    this.runs.set(runId, {
      runId,
      featureId: request.featureId,
      step,
      status: 'running',
      routing: routing ?? undefined,
      createdAt: now,
      updatedAt: now,
    });

    this.publishEvent({
      id: randomUUID(),
      runId,
      timestamp: now,
      type: 'started',
      featureId: request.featureId,
      goal: request.goal,
      step,
    });

    if (!routing) {
      this.handleRunError(runId, 'No connection configured for SDD run.');
      return;
    }

    if (!this.agentHostManager) {
      this.handleRunError(runId, 'Agent Host not available.');
      return;
    }

    try {
      await this.agentHostManager.startSddRun(runId, {
        ...request,
        connectionId: routing.connectionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start SDD run';
      this.handleRunError(runId, message);
    }
  }

  public async controlRun(request: SddRunControlRequest): Promise<void> {
    const run = this.runs.get(request.runId);
    if (!run) {
      throw new Error(`SDD run not found: ${request.runId}`);
    }

    if (!this.agentHostManager) {
      if (request.action === 'cancel') {
        this.handleRunError(request.runId, request.reason ?? 'Run canceled.');
        return;
      }
      throw new Error('Agent Host not available.');
    }

    await this.agentHostManager.controlSddRun(request);
  }

  private resolveRouting(
    request: SddRunStartRequest
  ): SddRunRecord['routing'] | null {
    const settings = settingsService.getSettings();
    const connectionId = request.connectionId ?? settings.agents.defaultConnectionId;
    if (!connectionId) {
      return null;
    }

    const connection = connectionsService
      .listConnections()
      .find((item) => item.metadata.id === connectionId);

    if (!connection) {
      return null;
    }

    return {
      connectionId,
      providerId: connection.metadata.providerId,
      modelRef: getConnectionModelRef(connection),
    };
  }

  private handleAgentEvent(event: SddRunEvent): void {
    const parsed = SddRunEventSchema.safeParse(event);
    if (!parsed.success) {
      return;
    }

    const validated = parsed.data;
    this.updateRunFromEvent(validated);
    this.publishEvent(validated);
  }

  private handleRunError(runId: string, message: string): void {
    this.updateRunStatus(runId, 'failed');
    this.publishEvent({
      id: randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      type: 'runFailed',
      message,
      code: 'error',
    });
  }

  private updateRunFromEvent(event: SddRunEvent): void {
    if (event.type === 'started') {
      const now = new Date().toISOString();
      this.runs.set(event.runId, {
        runId: event.runId,
        featureId: event.featureId,
        step: event.step,
        status: 'running',
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    if (event.type === 'stepStarted') {
      this.updateRun(event.runId, { step: event.step });
      return;
    }

    if (event.type === 'runCompleted') {
      this.updateRunStatus(event.runId, 'completed');
      return;
    }

    if (event.type === 'runFailed') {
      this.updateRunStatus(event.runId, 'failed');
    }
  }

  private updateRunStatus(runId: string, status: SddRunRecord['status']): void {
    this.updateRun(runId, { status });
  }

  private updateRun(runId: string, updates: Partial<SddRunRecord>): void {
    const existing = this.runs.get(runId);
    if (!existing) {
      return;
    }

    this.runs.set(runId, {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  private publishEvent(event: SddRunEvent): void {
    const parsed = SddRunEventSchema.safeParse(event);
    if (!parsed.success) {
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
        contents.send(IPC_CHANNELS.SDD_RUNS_EVENT, parsed.data);
      } catch {
        // Ignore send failures for closing windows.
      }
    }
  }
}

export const sddRunCoordinator = SddRunCoordinator.getInstance();
