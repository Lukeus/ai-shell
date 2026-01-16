import { spawn, type ChildProcess } from 'child_process';
import { type Connection, type McpListServersResponse, type McpServerControlRequest, type McpServerRef, type McpServerSettings, type McpServerState, type McpServerStatus, type McpServerStatusRequest, type McpToolDefinition, type McpToolListResponse, type PartialSettings, type Settings } from 'packages-api-contracts';
import { settingsService } from './SettingsService';
import { connectionsService } from './ConnectionsService';
import { secretsService } from './SecretsService';
import { buildChildProcessEnv } from './child-env';
import { getExtensionRegistry } from '../index';
import { buildMcpServerKey, getMcpServerDefinitions, type ExtensionSnapshot, type McpServerDefinition } from './mcp-server-definitions';
import { getMcpServerSettings, resolveMcpConnection, resolveMcpEnv } from './mcp-server-env';
type McpServerRuntime = { child: ChildProcess | null; status: McpServerStatus; tools: McpToolDefinition[]; };
type McpServerManagerDeps = { getExtensions: () => ExtensionSnapshot[]; getSettings: () => Settings; updateSettings: (updates: PartialSettings) => Settings; listConnections: () => Connection[]; getSecret: (secretRef: string) => string; buildEnv: typeof buildChildProcessEnv; now?: () => string; };
const STOP_TIMEOUT_MS = 5000;
export class McpServerManager {
  private readonly deps: McpServerManagerDeps;
  private readonly runtimes = new Map<string, McpServerRuntime>();
  constructor(deps: McpServerManagerDeps) {
    this.deps = deps;
  }
  public listServers(): McpListServersResponse {
    const definitions = getMcpServerDefinitions(this.deps.getExtensions());
    const settings = this.deps.getSettings();
    const servers = Array.from(definitions.entries()).map(([key, def]) => {
      const runtime = this.ensureRuntime(key, def);
      const serverSettings = getMcpServerSettings(settings, key);
      return {
        extensionId: def.extensionId,
        serverId: def.serverId,
        name: def.name,
        transport: def.transport,
        connectionProviderId: def.connectionProviderId,
        enabled: serverSettings.enabled,
        status: runtime.status,
      };
    });
    return { servers };
  }
  public getStatus(request: McpServerStatusRequest): McpServerStatus {
    const { key, def } = this.getDefinition(request);
    return this.ensureRuntime(key, def).status;
  }
  public async startServer(request: McpServerControlRequest): Promise<McpServerStatus> {
    const { key, def } = this.getDefinition(request);
    const runtime = this.ensureRuntime(key, def);
    if (runtime.status.state === 'running' || runtime.status.state === 'starting' || runtime.status.state === 'stopping') {
      return runtime.status;
    }
    this.updateServerSettings(key, { enabled: true });
    const settings = this.deps.getSettings();
    if (def.transport !== 'stdio') {
      return this.updateStatus(key, def, 'failed', 'Unsupported MCP transport');
    }
    const connectionResult = resolveMcpConnection(def, settings, key, this.deps.listConnections());
    if (connectionResult.error) {
      return this.updateStatus(key, def, 'failed', connectionResult.error);
    }
    const envResult = resolveMcpEnv(def.env, connectionResult.connection, this.deps.getSecret);
    if (envResult.error) {
      return this.updateStatus(key, def, 'failed', envResult.error);
    }
    this.updateStatus(key, def, 'starting');
    try {
      this.spawnServer(def, envResult.env ?? {}, runtime);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start MCP server';
      return this.updateStatus(key, def, 'failed', message);
    }
    return runtime.status;
  }
  public async stopServer(request: McpServerControlRequest): Promise<McpServerStatus> {
    const { key, def } = this.getDefinition(request);
    const runtime = this.ensureRuntime(key, def);
    this.updateServerSettings(key, { enabled: false });
    if (!runtime.child) {
      return this.updateStatus(key, def, 'stopped');
    }
    this.updateStatus(key, def, 'stopping');
    try {
      runtime.child.kill('SIGTERM');
      this.scheduleKill(runtime.child, key);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop MCP server';
      return this.updateStatus(key, def, 'failed', message);
    }
    return runtime.status;
  }
  public async refreshTools(request: McpServerControlRequest): Promise<McpToolListResponse> {
    const { key, def } = this.getDefinition(request);
    const runtime = this.ensureRuntime(key, def);
    return { server: { extensionId: def.extensionId, serverId: def.serverId }, tools: runtime.tools };
  }
  public setTools(request: McpServerRef, tools: McpToolDefinition[]): void {
    const { key, def } = this.getDefinition(request);
    const runtime = this.ensureRuntime(key, def);
    runtime.tools = tools;
  }
  public getServerProcess(ref: McpServerRef): ChildProcess | null {
    const key = buildMcpServerKey(ref.extensionId, ref.serverId);
    return this.runtimes.get(key)?.child ?? null;
  }
  private getDefinition(request: McpServerRef): { key: string; def: McpServerDefinition } {
    const definitions = getMcpServerDefinitions(this.deps.getExtensions());
    const key = buildMcpServerKey(request.extensionId, request.serverId);
    const def = definitions.get(key);
    if (!def) {
      throw new Error(`MCP server not found: ${key}`);
    }
    return { key, def };
  }
  private ensureRuntime(key: string, def: McpServerDefinition): McpServerRuntime {
    const existing = this.runtimes.get(key);
    if (existing) {
      return existing;
    }
    const runtime: McpServerRuntime = {
      child: null,
      status: this.buildStatus(def, 'stopped'),
      tools: [],
    };
    this.runtimes.set(key, runtime);
    return runtime;
  }
  private buildStatus(def: McpServerDefinition, state: McpServerState, message?: string): McpServerStatus {
    return {
      extensionId: def.extensionId,
      serverId: def.serverId,
      state,
      message,
      updatedAt: this.deps.now ? this.deps.now() : new Date().toISOString(),
    };
  }
  private updateStatus(key: string, def: McpServerDefinition, state: McpServerState, message?: string): McpServerStatus {
    const runtime = this.ensureRuntime(key, def);
    runtime.status = this.buildStatus(def, state, message);
    return runtime.status;
  }
  private updateServerSettings(key: string, updates: Partial<McpServerSettings>): void {
    this.deps.updateSettings({
      mcp: {
        servers: {
          [key]: updates,
        },
      },
    });
  }
  private spawnServer(def: McpServerDefinition, env: Record<string, string>, runtime: McpServerRuntime): void {
    const child = spawn(def.command, def.args, {
      cwd: def.extensionPath,
      env: this.deps.buildEnv({ extra: env, includeElectronRunAsNode: false }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    runtime.child = child;
    this.attachProcessHandlers(child, def);
    if (child.stderr) {
      child.stderr.on('data', () => undefined);
    }
  }
  private attachProcessHandlers(child: ChildProcess, def: McpServerDefinition): void {
    const key = buildMcpServerKey(def.extensionId, def.serverId);
    child.on('spawn', () => {
      this.updateStatus(key, def, 'running');
    });
    child.on('error', (error) => {
      this.updateStatus(key, def, 'failed', error.message);
      const runtime = this.runtimes.get(key);
      if (runtime?.child === child) {
        runtime.child = null;
      }
    });
    child.on('exit', (code, signal) => {
      const runtime = this.runtimes.get(key);
      if (!runtime || runtime.child !== child) {
        return;
      }
      runtime.child = null;
      if (runtime.status.state === 'stopping') {
        this.updateStatus(key, def, 'stopped');
        return;
      }
      if (code === 0) {
        this.updateStatus(key, def, 'stopped');
        return;
      }
      const message = code !== null
        ? `Exited with code ${code}`
        : `Exited with signal ${signal ?? 'unknown'}`;
      this.updateStatus(key, def, 'failed', message);
    });
  }
  private scheduleKill(child: ChildProcess, key: string): void {
    setTimeout(() => {
      const runtime = this.runtimes.get(key);
      if (!runtime || runtime.child !== child || child.killed) {
        return;
      }
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore failed kill attempts.
      }
    }, STOP_TIMEOUT_MS);
  }
}
let singleton: McpServerManager | null = null;
export const getMcpServerManager = (): McpServerManager => {
  if (!singleton) {
    singleton = new McpServerManager({
      getExtensions: () => {
        const registry = getExtensionRegistry();
        return registry ? registry.getEnabledExtensions() : [];
      },
      getSettings: () => settingsService.getSettings(),
      updateSettings: (updates) => settingsService.updateSettings(updates),
      listConnections: () => connectionsService.listConnections(),
      getSecret: (secretRef) => secretsService.getSecret(secretRef),
      buildEnv: buildChildProcessEnv,
    });
  }
  return singleton;
};
