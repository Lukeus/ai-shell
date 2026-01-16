import { fork, type ChildProcess } from 'child_process';
import { app } from 'electron';
import {
  AgentEventSchema,
  SddRunEventSchema,
  ToolCallEnvelopeSchema,
  type AgentEvent,
  type AgentRunStartRequest,
  type SddRunEvent,
  type SddRunStartRequest,
  type SddRunControlRequest,
  type ToolCallEnvelope,
} from 'packages-api-contracts';
import * as brokerMainModule from 'packages-broker-main';
import type { ExtensionToolService } from './extension-tool-service';
import { buildChildProcessEnv } from './child-env';
import type { McpToolBridge } from './McpToolBridge';
import type { AgentHostInboundMessage, AgentHostOutboundMessage } from './agent-host/agent-host-messages';
import { createBuiltInToolsRegistrar, type BuiltInToolsRegistrar } from './agent-host/built-in-tools';
import { createToolCallHandler, type ToolCallHandler } from './agent-host/tool-call-handler';
import { createAgentHostRunOrchestrator, type AgentHostRunOrchestrator } from './agent-host/run-orchestration';
import type { BrokerMainInstance } from './agent-host/types';

type AgentHostConfig = {
  agentHostPath: string;
  brokerMain?: BrokerMainInstance;
  getExtensionToolService?: () => ExtensionToolService | null;
  getMcpToolBridge?: () => McpToolBridge | null;
};

/**
 * AgentHostManager - Spawns and manages the Agent Host child process.
 *
 * P1 (Process Isolation): Agent Host runs as a separate Node.js process.
 * Communicates via IPC messages (process.send).
 */
export class AgentHostManager {
  private readonly config: AgentHostConfig;
  private readonly brokerMain: BrokerMainInstance;
  private readonly runOrchestrator: AgentHostRunOrchestrator;
  private readonly builtInTools: BuiltInToolsRegistrar;
  private readonly toolCallHandler: ToolCallHandler;
  private childProcess: ChildProcess | null = null;
  private eventHandlers: Array<(event: AgentEvent) => void> = [];
  private runErrorHandlers: Array<(runId: string, message: string) => void> = [];
  private sddEventHandlers: Array<(event: SddRunEvent) => void> = [];
  private sddRunErrorHandlers: Array<(runId: string, message: string) => void> = [];
  private isShuttingDown = false;

  constructor(config: AgentHostConfig) {
    this.config = config;
    const BrokerMain = brokerMainModule.BrokerMain;
    this.brokerMain = config.brokerMain ?? new BrokerMain();
    this.builtInTools = createBuiltInToolsRegistrar(this.brokerMain);
    this.runOrchestrator = createAgentHostRunOrchestrator({
      brokerMain: this.brokerMain,
      sendMessage: (message) => this.sendToAgentHost(message),
    });
    this.toolCallHandler = createToolCallHandler({
      brokerMain: this.brokerMain,
      builtInTools: this.builtInTools,
      getExtensionToolService: config.getExtensionToolService,
      getMcpToolBridge: config.getMcpToolBridge,
      sendMessage: (message) => this.sendToAgentHost(message),
    });
  }

  public async start(): Promise<void> {
    if (this.childProcess) {
      return;
    }

    this.childProcess = fork(this.config.agentHostPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: buildChildProcessEnv({
        extra: {
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      }),
      cwd: app.getPath('userData'),
    });

    this.childProcess.on('message', (message: AgentHostInboundMessage) => {
      this.handleMessage(message);
    });

    this.childProcess.on('exit', (code, signal) => {
      if (!this.isShuttingDown) {
        console.error(`[AgentHostManager] Agent Host exited with code ${code} signal ${signal}`);
      }
      this.childProcess = null;
    });

    this.childProcess.on('error', (error) => {
      console.error('[AgentHostManager] Agent Host process error:', error);
    });

    this.builtInTools.registerOnce();
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (!this.childProcess) {
      return;
    }

    try {
      this.childProcess.kill('SIGTERM');
    } finally {
      this.childProcess = null;
    }
  }

  public isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }

  public onEvent(handler: (event: AgentEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  public onRunError(handler: (runId: string, message: string) => void): () => void {
    this.runErrorHandlers.push(handler);
    return () => {
      this.runErrorHandlers = this.runErrorHandlers.filter((h) => h !== handler);
    };
  }

  public onSddEvent(handler: (event: SddRunEvent) => void): () => void {
    this.sddEventHandlers.push(handler);
    return () => {
      this.sddEventHandlers = this.sddEventHandlers.filter((h) => h !== handler);
    };
  }

  public onSddRunError(handler: (runId: string, message: string) => void): () => void {
    this.sddRunErrorHandlers.push(handler);
    return () => {
      this.sddRunErrorHandlers = this.sddRunErrorHandlers.filter((h) => h !== handler);
    };
  }

  public async startRun(
    runId: string,
    request: AgentRunStartRequest,
    toolCalls: ToolCallEnvelope[] = []
  ): Promise<void> {
    await this.start();
    this.runOrchestrator.startRun(runId, request, toolCalls);
  }

  public async cancelRun(runId: string, reason?: string): Promise<void> {
    if (!this.childProcess) {
      return;
    }

    this.runOrchestrator.cancelRun(runId, reason);
  }

  public async startSddRun(runId: string, request: SddRunStartRequest): Promise<void> {
    await this.start();
    this.runOrchestrator.startSddRun(runId, request);
  }

  public async controlSddRun(request: SddRunControlRequest): Promise<void> {
    await this.start();
    this.runOrchestrator.controlSddRun(request);
  }

  private sendToAgentHost(message: AgentHostOutboundMessage): void {
    this.childProcess?.send(message);
  }

  private handleMessage(message: AgentHostInboundMessage): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'agent-host:event') {
      const parsed = AgentEventSchema.safeParse(message.event);
      if (!parsed.success) {
        return;
      }
      if (parsed.data.type === 'status') {
        const terminal =
          parsed.data.status === 'completed' ||
          parsed.data.status === 'failed' ||
          parsed.data.status === 'canceled';
        if (terminal) {
          this.brokerMain.clearRunPolicy(parsed.data.runId);
        }
      }
      this.eventHandlers.forEach((handler) => handler(parsed.data));
      return;
    }

    if (message.type === 'agent-host:run-error') {
      this.runErrorHandlers.forEach((handler) => handler(message.runId, message.message));
      return;
    }

    if (message.type === 'agent-host:sdd-event') {
      const parsed = SddRunEventSchema.safeParse(message.event);
      if (!parsed.success) {
        return;
      }
      this.sddEventHandlers.forEach((handler) => handler(parsed.data));
      return;
    }

    if (message.type === 'agent-host:sdd-run-error') {
      this.sddRunErrorHandlers.forEach((handler) => handler(message.runId, message.message));
      return;
    }

    if (message.type === 'agent-host:tool-call') {
      const parsed = ToolCallEnvelopeSchema.safeParse(message.payload);
      if (!parsed.success) {
        return;
      }
      void this.toolCallHandler(parsed.data);
    }
  }
}
