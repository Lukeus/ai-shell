import { fork, spawn, type ChildProcess } from 'child_process';
import { app } from 'electron';
import {
  AgentEventSchema,
  AgentRunStartRequestSchema,
  JsonValueSchema,
  ToolCallEnvelopeSchema,
  type AgentEvent,
  type AgentRunStartRequest,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { z } from 'zod';
import * as brokerMainModule from 'packages-broker-main';
import type { ExtensionToolService } from './extension-tool-service';
import { fsBrokerService } from './FsBrokerService';
import { workspaceService } from './WorkspaceService';

type BrokerMainInstance = InstanceType<typeof brokerMainModule.BrokerMain>;

type AgentHostConfig = {
  agentHostPath: string;
  brokerMain?: BrokerMainInstance;
  getExtensionToolService?: () => ExtensionToolService | null;
};

type StartRunMessage = {
  type: 'agent-host:start-run';
  runId: string;
  request: AgentRunStartRequest;
  toolCalls?: ToolCallEnvelope[];
};

type AgentHostEventMessage = {
  type: 'agent-host:event';
  event: AgentEvent;
};

type AgentHostRunErrorMessage = {
  type: 'agent-host:run-error';
  runId: string;
  message: string;
};

type AgentHostToolCallMessage = {
  type: 'agent-host:tool-call';
  payload: ToolCallEnvelope;
};

type AgentHostToolResultMessage = {
  type: 'agent-host:tool-result';
  payload: ToolCallResult;
};

type AgentHostMessage =
  | AgentHostEventMessage
  | AgentHostRunErrorMessage
  | AgentHostToolCallMessage
  | AgentHostToolResultMessage;

/**
 * AgentHostManager - Spawns and manages the Agent Host child process.
 *
 * P1 (Process Isolation): Agent Host runs as a separate Node.js process.
 * Communicates via IPC messages (process.send).
 */
export class AgentHostManager {
  private readonly config: AgentHostConfig;
  private readonly brokerMain: BrokerMainInstance;
  private childProcess: ChildProcess | null = null;
  private eventHandlers: Array<(event: AgentEvent) => void> = [];
  private runErrorHandlers: Array<(runId: string, message: string) => void> = [];
  private isShuttingDown = false;
  private builtInsRegistered = false;

  constructor(config: AgentHostConfig) {
    this.config = config;
    const BrokerMain = brokerMainModule.BrokerMain;
    this.brokerMain = config.brokerMain ?? new BrokerMain();
  }

  public async start(): Promise<void> {
    if (this.childProcess) {
      return;
    }

    this.childProcess = fork(this.config.agentHostPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
      cwd: app.getPath('userData'),
    });

    this.childProcess.on('message', (message: AgentHostMessage) => {
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

    this.registerBuiltInTools();
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

  public async startRun(
    runId: string,
    request: AgentRunStartRequest,
    toolCalls: ToolCallEnvelope[] = []
  ): Promise<void> {
    await this.start();

    const validatedRequest = AgentRunStartRequestSchema.parse(request);
    const validatedToolCalls = ToolCallEnvelopeSchema.array().parse(toolCalls);
    const message: StartRunMessage = {
      type: 'agent-host:start-run',
      runId,
      request: validatedRequest,
      toolCalls: validatedToolCalls,
    };

    this.childProcess?.send(message);
  }

  private handleMessage(message: AgentHostMessage): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'agent-host:event') {
      const parsed = AgentEventSchema.safeParse(message.event);
      if (!parsed.success) {
        return;
      }
      this.eventHandlers.forEach((handler) => handler(parsed.data));
      return;
    }

    if (message.type === 'agent-host:run-error') {
      this.runErrorHandlers.forEach((handler) => handler(message.runId, message.message));
      return;
    }

    if (message.type === 'agent-host:tool-call') {
      const parsed = ToolCallEnvelopeSchema.safeParse(message.payload);
      if (!parsed.success) {
        return;
      }
      void this.handleToolCall(parsed.data);
    }
  }

  private async handleToolCall(envelope: ToolCallEnvelope): Promise<void> {
    this.registerBuiltInTools();
    const extensionToolService = this.config.getExtensionToolService?.();
    if (extensionToolService?.hasTool(envelope.toolId)) {
      const registered = this.brokerMain.listTools().includes(envelope.toolId);
      if (!registered) {
        const tool = extensionToolService.getTool(envelope.toolId);
        this.brokerMain.registerToolDefinition({
          id: envelope.toolId,
          description: tool?.description ?? envelope.toolId,
          inputSchema: JsonValueSchema,
          outputSchema: JsonValueSchema,
          category: 'other',
          execute: async (input) => {
            const result = await extensionToolService.executeTool(envelope.toolId, input);
            if (!result.success) {
              throw new Error(result.error ?? 'Tool execution failed');
            }
            return result.result;
          },
        });
      }
    }

    const result = await this.brokerMain.handleAgentToolCall(envelope);
    const response: AgentHostToolResultMessage = {
      type: 'agent-host:tool-result',
      payload: result,
    };
    this.childProcess?.send(response);
  }

  private registerBuiltInTools(): void {
    if (this.builtInsRegistered) {
      return;
    }

    const workspaceReadInput = z.object({ path: z.string() });
    const workspaceReadOutput = z.object({ content: z.string(), encoding: z.string() });
    const workspaceWriteInput = z.object({ path: z.string(), content: z.string() });
    const workspaceWriteOutput = z.object({ success: z.literal(true) });
    const repoSearchInput = z.object({ query: z.string().min(1), glob: z.string().optional() });
    const repoSearchOutput = z.object({
      matches: z.array(
        z.object({
          file: z.string(),
          line: z.number().int().min(1),
          text: z.string(),
        })
      ),
    });

    this.brokerMain.registerToolDefinition({
      id: 'workspace.read',
      description: 'Read a file within the workspace.',
      inputSchema: workspaceReadInput,
      outputSchema: workspaceReadOutput,
      category: 'fs',
      execute: async (input) => {
        const { path } = input as z.infer<typeof workspaceReadInput>;
        return fsBrokerService.readFile(path);
      },
    });

    this.brokerMain.registerToolDefinition({
      id: 'workspace.write',
      description: 'Write a file within the workspace (create or overwrite).',
      inputSchema: workspaceWriteInput,
      outputSchema: workspaceWriteOutput,
      category: 'fs',
      execute: async (input) => {
        const { path, content } = input as z.infer<typeof workspaceWriteInput>;
        await fsBrokerService.createFile(path, content);
        return { success: true };
      },
    });

    this.brokerMain.registerToolDefinition({
      id: 'workspace.update',
      description: 'Update a file within the workspace.',
      inputSchema: workspaceWriteInput,
      outputSchema: workspaceWriteOutput,
      category: 'fs',
      execute: async (input) => {
        const { path, content } = input as z.infer<typeof workspaceWriteInput>;
        await fsBrokerService.createFile(path, content);
        return { success: true };
      },
    });

    this.brokerMain.registerToolDefinition({
      id: 'repo.search',
      description: 'Search the workspace using ripgrep.',
      inputSchema: repoSearchInput,
      outputSchema: repoSearchOutput,
      category: 'repo',
      execute: async (input) => {
        const { query, glob } = input as z.infer<typeof repoSearchInput>;
        const workspace = workspaceService.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace open.');
        }

        const args = ['--json', query];
        if (glob) {
          args.push('-g', glob);
        }

        const matches: Array<{ file: string; line: number; text: string }> = [];
        await new Promise<void>((resolve, reject) => {
          const child = spawn('rg', args, { cwd: workspace.path });
          let stderr = '';

          child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((line) => line.length > 0);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line) as {
                  type?: string;
                  data?: {
                    path?: { text?: string };
                    line_number?: number;
                    lines?: { text?: string };
                  };
                };
                if (parsed.type === 'match' && parsed.data) {
                  const file = parsed.data.path?.text ?? 'unknown';
                  const lineNumber = parsed.data.line_number ?? 0;
                  const text = parsed.data.lines?.text ?? '';
                  if (lineNumber > 0) {
                    matches.push({ file, line: lineNumber, text: text.trimEnd() });
                  }
                }
              } catch {
                // Ignore non-JSON output.
              }
            }
          });

          child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          child.on('error', (error) => {
            reject(error);
          });

          child.on('close', (code) => {
            if (code === 0 || code === 1) {
              resolve();
              return;
            }
            reject(new Error(stderr.trim() || `ripgrep failed with code ${code}`));
          });
        });

        return { matches };
      },
    });

    this.builtInsRegistered = true;
  }
}
