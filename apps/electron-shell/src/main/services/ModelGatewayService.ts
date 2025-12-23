import type { Connection, Settings } from 'packages-api-contracts';
import {
  ModelGenerateRequestSchema,
  type ModelGenerateRequest,
  type ModelGenerateResponse,
} from 'packages-api-contracts';
import { connectionsService } from './ConnectionsService';
import { secretsService } from './SecretsService';
import { consentService } from './ConsentService';
import { auditService } from './AuditService';
import { settingsService } from './SettingsService';

type ModelGatewayDeps = {
  getSettings?: () => Settings;
  listConnections?: () => Connection[];
  getSecret?: (secretRef: string) => string;
  evaluateAccess?: (connectionId: string, requesterId: string) => boolean | null;
  logSecretAccess?: (input: {
    connectionId: string;
    requesterId: string;
    reason?: string;
    allowed: boolean;
  }) => void;
  logModelCall?: (input: {
    runId: string;
    providerId: string;
    connectionId: string;
    modelRef?: string;
    status: 'success' | 'error';
    durationMs: number;
    error?: string;
  }) => void;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

type ModelGatewayContext = {
  runId: string;
  requesterId: string;
};

const getStringConfig = (connection: Connection, key: string): string | undefined => {
  const value = connection.config[key];
  return typeof value === 'string' ? value : undefined;
};

const fetchWithTimeout = async (
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export class ModelGatewayService {
  private readonly deps: Required<ModelGatewayDeps>;

  constructor(deps: ModelGatewayDeps = {}) {
    this.deps = {
      getSettings: deps.getSettings ?? (() => settingsService.getSettings()),
      listConnections: deps.listConnections ?? (() => connectionsService.listConnections()),
      getSecret: deps.getSecret ?? ((secretRef) => secretsService.getSecret(secretRef)),
      evaluateAccess:
        deps.evaluateAccess ?? ((connectionId, requesterId) => consentService.evaluateAccess(connectionId, requesterId)),
      logSecretAccess:
        deps.logSecretAccess ??
        ((input) =>
          auditService.logSecretAccess({
            connectionId: input.connectionId,
            requesterId: input.requesterId,
            reason: input.reason,
            allowed: input.allowed,
          })),
      logModelCall:
        deps.logModelCall ??
        ((input) =>
          auditService.logModelCall({
            runId: input.runId,
            providerId: input.providerId,
            connectionId: input.connectionId,
            modelRef: input.modelRef,
            status: input.status,
            durationMs: input.durationMs,
            error: input.error,
          })),
      fetchFn: deps.fetchFn ?? fetch,
      timeoutMs: deps.timeoutMs ?? 30000,
    };
  }

  public async generate(
    request: ModelGenerateRequest,
    context: ModelGatewayContext
  ): Promise<ModelGenerateResponse> {
    const validated = ModelGenerateRequestSchema.parse(request);
    const settings = this.deps.getSettings();
    const fallbackConnectionId = settings.agents.defaultConnectionId;
    const connectionId = validated.connectionId ?? fallbackConnectionId;

    if (!connectionId) {
      throw new Error('No connection configured for model generation.');
    }

    const connection = this.deps
      .listConnections()
      .find((item) => item.metadata.id === connectionId);

    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const providerId = connection.metadata.providerId;
    const modelRef = validated.modelRef ?? getStringConfig(connection, 'model');

    if (!modelRef) {
      throw new Error('No model configured for this connection.');
    }

    const startedAt = Date.now();
    let status: 'success' | 'error' = 'error';
    let errorMessage: string | undefined;

    try {
      let text: string;
      if (providerId === 'ollama') {
        text = await this.generateWithOllama(connection, modelRef, validated);
      } else if (providerId === 'openai') {
        text = await this.generateWithOpenAI(connection, modelRef, validated, context);
      } else {
        throw new Error(`Unsupported provider: ${providerId}`);
      }

      status = 'success';
      return { text };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Model generation failed';
      throw new Error(errorMessage);
    } finally {
      const durationMs = Math.max(0, Date.now() - startedAt);
      this.deps.logModelCall({
        runId: context.runId,
        providerId,
        connectionId: connection.metadata.id,
        modelRef,
        status,
        durationMs,
        error: status === 'error' ? errorMessage : undefined,
      });
    }
  }

  private async generateWithOllama(
    connection: Connection,
    modelRef: string,
    request: ModelGenerateRequest
  ): Promise<string> {
    const baseUrl = getStringConfig(connection, 'baseUrl') ?? 'http://localhost:11434';
    const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;

    const body: Record<string, unknown> = {
      model: modelRef,
      prompt: request.prompt,
      stream: false,
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    if (request.temperature !== undefined) {
      body.options = { temperature: request.temperature };
    }

    const response = await fetchWithTimeout(
      this.deps.fetchFn,
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      this.deps.timeoutMs
    );

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(
        `Ollama request failed (${response.status}): ${message || response.statusText}`
      );
    }

    const data = (await response.json()) as { response?: string };
    if (!data.response) {
      throw new Error('Ollama response missing output.');
    }

    return data.response;
  }

  private async generateWithOpenAI(
    connection: Connection,
    modelRef: string,
    request: ModelGenerateRequest,
    context: ModelGatewayContext
  ): Promise<string> {
    const endpoint = getStringConfig(connection, 'endpoint') ?? 'https://api.openai.com';
    const url = `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;

    const secretRef = connection.metadata.secretRef;
    if (!secretRef) {
      throw new Error('OpenAI connection is missing a secret.');
    }

    const decision = this.deps.evaluateAccess(connection.metadata.id, context.requesterId);
    if (!decision) {
      this.deps.logSecretAccess({
        connectionId: connection.metadata.id,
        requesterId: context.requesterId,
        reason: 'model.generate',
        allowed: false,
      });
      throw new Error('Consent required for OpenAI connection.');
    }

    this.deps.logSecretAccess({
      connectionId: connection.metadata.id,
      requesterId: context.requesterId,
      reason: 'model.generate',
      allowed: true,
    });

    const apiKey = this.deps.getSecret(secretRef);
    const organization = getStringConfig(connection, 'organization');

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const body: Record<string, unknown> = {
      model: modelRef,
      messages,
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const response = await fetchWithTimeout(
      this.deps.fetchFn,
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      this.deps.timeoutMs
    );

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(
        `OpenAI request failed (${response.status}): ${message || response.statusText}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response missing output.');
    }

    return content;
  }
}

export const modelGatewayService = new ModelGatewayService();
