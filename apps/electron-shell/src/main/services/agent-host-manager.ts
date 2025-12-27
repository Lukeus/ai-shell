import { fork, spawn, type ChildProcess } from 'child_process';
import { app } from 'electron';
import { createHash } from 'crypto';
import * as fs from 'fs';
import {
  AgentEventSchema,
  AgentRunStartRequestSchema,
  JsonValueSchema,
  ModelGenerateRequestSchema,
  ModelGenerateResponseSchema,
  SddRunEventSchema,
  SddRunStartRequestSchema,
  SddRunControlRequestSchema,
  ToolCallEnvelopeSchema,
  type AgentEvent,
  type AgentRunStartRequest,
  type SddRunEvent,
  type SddRunStartRequest,
  type SddRunControlRequest,
  type ToolCallEnvelope,
  type ToolCallResult,
} from 'packages-api-contracts';
import { z } from 'zod';
import * as brokerMainModule from 'packages-broker-main';
import type { ExtensionToolService } from './extension-tool-service';
import { fsBrokerService } from './FsBrokerService';
import { workspaceService } from './WorkspaceService';
import { buildChildProcessEnv } from './child-env';
import { sddTraceService } from './SddTraceService';
import { resolvePathWithinWorkspace } from './workspace-paths';
import { modelGatewayService } from './ModelGatewayService';

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

type CancelRunMessage = {
  type: 'agent-host:cancel-run';
  runId: string;
  reason?: string;
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

type AgentHostSddStartRunMessage = {
  type: 'agent-host:sdd-start-run';
  runId: string;
  request: SddRunStartRequest;
};

type AgentHostSddControlRunMessage = {
  type: 'agent-host:sdd-control-run';
  request: SddRunControlRequest;
};

type AgentHostSddEventMessage = {
  type: 'agent-host:sdd-event';
  event: SddRunEvent;
};

type AgentHostSddRunErrorMessage = {
  type: 'agent-host:sdd-run-error';
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
  | AgentHostSddEventMessage
  | AgentHostSddRunErrorMessage
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
  private sddEventHandlers: Array<(event: SddRunEvent) => void> = [];
  private sddRunErrorHandlers: Array<(runId: string, message: string) => void> = [];
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
      env: buildChildProcessEnv({
        extra: {
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      }),
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

    const validatedRequest = AgentRunStartRequestSchema.parse(request);
    this.brokerMain.setRunPolicy(runId, validatedRequest.config?.policy);
    const validatedToolCalls = ToolCallEnvelopeSchema.array().parse(toolCalls);
    const message: StartRunMessage = {
      type: 'agent-host:start-run',
      runId,
      request: validatedRequest,
      toolCalls: validatedToolCalls,
    };

    this.childProcess?.send(message);
  }

  public async cancelRun(runId: string, reason?: string): Promise<void> {
    if (!this.childProcess) {
      return;
    }

    const message: CancelRunMessage = {
      type: 'agent-host:cancel-run',
      runId,
      reason,
    };

    this.childProcess.send(message);
  }

  public async startSddRun(runId: string, request: SddRunStartRequest): Promise<void> {
    await this.start();

    const validatedRequest = SddRunStartRequestSchema.parse(request);
    const message: AgentHostSddStartRunMessage = {
      type: 'agent-host:sdd-start-run',
      runId,
      request: validatedRequest,
    };

    this.childProcess?.send(message);
  }

  public async controlSddRun(request: SddRunControlRequest): Promise<void> {
    await this.start();

    const validatedRequest = SddRunControlRequestSchema.parse(request);
    const message: AgentHostSddControlRunMessage = {
      type: 'agent-host:sdd-control-run',
      request: validatedRequest,
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
          inputSchema: tool?.inputValidator ?? JsonValueSchema,
          outputSchema: tool?.outputValidator ?? JsonValueSchema,
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
    
    // Validate output conforms to JsonValue before sending over IPC
    const validatedResult: ToolCallResult = {
      ...result,
      output: result.output !== undefined ? JsonValueSchema.parse(result.output) : undefined,
    };
    
    const response: AgentHostToolResultMessage = {
      type: 'agent-host:tool-result',
      payload: validatedResult,
    };
    this.childProcess?.send(response);
  }

  private async buildAgentFileChange(
    requestPath: string,
    content: string
  ): Promise<{
    path: string;
    op: 'added' | 'modified';
    hashBefore?: string;
    hashAfter: string;
  } | null> {
    const workspace = workspaceService.getWorkspace();
    if (!workspace) {
      return null;
    }

    let resolvedPath = requestPath;
    try {
      resolvedPath = await resolvePathWithinWorkspace(requestPath, workspace.path, {
        requireExisting: false,
      });
    } catch {
      return null;
    }

    const { exists, hashBefore } = await this.readExistingFileHash(resolvedPath);
    const hashAfter = this.hashContent(content);

    return {
      path: resolvedPath,
      op: exists ? 'modified' : 'added',
      hashBefore,
      hashAfter,
    };
  }

  private async readExistingFileHash(
    filePath: string
  ): Promise<{ exists: boolean; hashBefore?: string }> {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        return { exists: false };
      }
      try {
        const content = await fs.promises.readFile(filePath);
        return { exists: true, hashBefore: createHash('sha256').update(content).digest('hex') };
      } catch {
        return { exists: true };
      }
    } catch (error) {
      if (this.isMissingPathError(error)) {
        return { exists: false };
      }
      return { exists: false };
    }
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  private isMissingPathError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR';
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
    const repoListInput = z.object({
      glob: z.string().optional(),
      root: z.string().optional(),
      maxResults: z.number().int().min(1).max(5000).optional(),
    });
    const repoListOutput = z.object({
      files: z.array(z.string()),
      truncated: z.boolean().optional(),
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
        const change = await this.buildAgentFileChange(path, content);
        await fsBrokerService.createFile(path, content);
        if (change) {
          try {
            await sddTraceService.recordFileChange({
              path: change.path,
              op: change.op,
              actor: 'agent',
              hashBefore: change.hashBefore,
              hashAfter: change.hashAfter,
            });
          } catch {
            // Ignore SDD failures so agent tool execution succeeds.
          }
        }
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
        const change = await this.buildAgentFileChange(path, content);
        await fsBrokerService.createFile(path, content);
        if (change) {
          try {
            await sddTraceService.recordFileChange({
              path: change.path,
              op: change.op,
              actor: 'agent',
              hashBefore: change.hashBefore,
              hashAfter: change.hashAfter,
            });
          } catch {
            // Ignore SDD failures so agent tool execution succeeds.
          }
        }
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

    this.brokerMain.registerToolDefinition({
      id: 'model.generate',
      description: 'Generate a model response using a configured connection.',
      inputSchema: ModelGenerateRequestSchema,
      outputSchema: ModelGenerateResponseSchema,
      category: 'net',
      execute: async (input, context) => {
        const envelope = context?.envelope as ToolCallEnvelope | undefined;
        if (!envelope) {
          throw new Error('Missing tool execution envelope.');
        }
        const request = ModelGenerateRequestSchema.parse(input);
        return await modelGatewayService.generate(request, {
          runId: envelope.runId,
          requesterId: envelope.requesterId,
        });
      },
    });

    this.brokerMain.registerToolDefinition({
      id: 'repo.list',
      description: 'List workspace files using ripgrep with optional glob.',
      inputSchema: repoListInput,
      outputSchema: repoListOutput,
      category: 'repo',
      execute: async (input) => {
        const workspace = workspaceService.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace open.');
        }

        const request = repoListInput.parse(input);
        const rootPath = request.root
          ? await resolvePathWithinWorkspace(request.root, workspace.path, { requireExisting: true })
          : workspace.path;
        const maxResults = request.maxResults ?? 2000;
        const args = ['--files'];
        if (request.glob) {
          args.push('-g', request.glob);
        }

        const files: string[] = [];
        let truncated = false;

        await new Promise<void>((resolve, reject) => {
          const child = spawn('rg', args, { cwd: rootPath });
          let stderr = '';

          child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((line) => line.length > 0);
            for (const line of lines) {
              if (files.length >= maxResults) {
                truncated = true;
                child.kill();
                break;
              }
              files.push(line);
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

        return { files, truncated: truncated || undefined };
      },
    });

    this.builtInsRegistered = true;
  }
}
