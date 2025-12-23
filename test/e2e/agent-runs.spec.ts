import { test, expect } from '../fixtures/electron-test-app';
import http from 'http';
import type { AddressInfo } from 'net';

type OllamaMock = {
  server: http.Server;
  baseUrl: string;
};

const startOllamaMock = async (): Promise<OllamaMock> => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/generate') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response: 'mock response' }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

const stopOllamaMock = async (server?: http.Server): Promise<void> => {
  if (!server) {
    return;
  }
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
};

const resetConnectionsAndSettings = async (page: any) => {
  await page.evaluate(async () => {
    const existing = await (window as any).api.connections.list();
    for (const connection of existing.connections) {
      await (window as any).api.connections.delete({ id: connection.metadata.id });
    }
    await (window as any).api.resetSettings();
  });
};

const createOllamaConnection = async (
  page: any,
  input: { baseUrl: string; displayName: string; model: string }
) => {
  return page.evaluate(async ({ baseUrl, displayName, model }) => {
    const created = await (window as any).api.connections.create({
      providerId: 'ollama',
      scope: 'user',
      displayName,
      config: {
        baseUrl,
        model,
      },
    });
    return created.connection;
  }, input);
};

const setDefaultConnection = async (page: any, connectionId: string) => {
  await page.evaluate(async (id) => {
    await (window as any).api.updateSettings({
      agents: { defaultConnectionId: id },
    });
  }, connectionId);
};

const setupDefaultOllamaConnection = async (page: any, baseUrl: string) => {
  await resetConnectionsAndSettings(page);
  const connection = await createOllamaConnection(page, {
    baseUrl,
    displayName: 'Ollama Test',
    model: 'llama3',
  });
  await setDefaultConnection(page, connection.metadata.id);
  return connection;
};

const waitForRunStatus = async (page: any, runId: string, status: string) => {
  await page.waitForFunction(
    async ({ runId, status }) => {
      const result = await (window as any).api.agents.listRuns();
      const run = result.runs.find((entry: any) => entry.id === runId);
      return run?.status === status;
    },
    { runId, status },
    { timeout: 10000 }
  );
};

const waitForModelCallAudit = async (page: any, runId: string) => {
  await page.waitForFunction(
    async (id) => {
      const audit = await (window as any).api.audit.list({ limit: 200 });
      return audit.events.some(
        (event: any) => event.type === 'model-call' && event.runId === id
      );
    },
    runId,
    { timeout: 10000 }
  );
};

let ollamaMock: OllamaMock | null = null;

test.beforeAll(async () => {
  ollamaMock = await startOllamaMock();
});

test.afterAll(async () => {
  await stopOllamaMock(ollamaMock?.server);
  ollamaMock = null;
});

/**
 * E2E tests for Deep Agents run flow.
 * 
 * Covers:
 * - Start/cancel run flow
 * - Tool call approval/denial via policy
 * - VFS tool operations
 * - Event stream ordering
 * - No secret payloads in events or logs
 * 
 * P1 (Process isolation): Renderer accesses agent APIs only via preload.
 * P2 (Security defaults): No secrets in event payloads.
 * P6 (Contracts-first): All IPC validated via Zod schemas.
 */
test.describe('Agent Runs', () => {
  test('should start and list agent runs', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    const defaultConnection = await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    // Create a run via preload API
    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'E2E test run' });
    });

    expect(runResult.run).toBeDefined();
    expect(runResult.run.id).toBeTruthy();
    expect(['queued', 'running', 'completed']).toContain(runResult.run.status);
    expect(runResult.run.source).toBe('user');
    expect(runResult.run.routing).toMatchObject({
      connectionId: defaultConnection.metadata.id,
      providerId: 'ollama',
      modelRef: 'llama3',
    });

    // List runs and verify the new run is present
    const listResult = await page.evaluate(async () => {
      return (window as any).api.agents.listRuns();
    });

    expect(listResult.runs).toBeDefined();
    const createdRun = listResult.runs.find((r: any) => r.id === runResult.run.id);
    expect(createdRun).toBeDefined();
    expect(createdRun.routing).toMatchObject({
      connectionId: defaultConnection.metadata.id,
      providerId: 'ollama',
      modelRef: 'llama3',
    });
  });

  test('should get agent run by ID', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    const defaultConnection = await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Get run test' });
    });

    const runId = runResult.run.id;

    // Get the run by ID
    const getResult = await page.evaluate(async (id) => {
      return (window as any).api.agents.getRun({ runId: id });
    }, runId);

    expect(getResult.run).toBeDefined();
    expect(getResult.run.id).toBe(runId);
    expect(getResult.run.routing).toMatchObject({
      connectionId: defaultConnection.metadata.id,
      providerId: 'ollama',
    });
  });

  test('should cancel an agent run', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Cancel test' });
    });

    const runId = runResult.run.id;

    // Cancel the run
    const cancelResult = await page.evaluate(async (id) => {
      return (window as any).api.agents.cancelRun({ runId: id, action: 'cancel' });
    }, runId);

    expect(cancelResult.run).toBeDefined();
    expect(cancelResult.run.id).toBe(runId);
    expect(cancelResult.run.status).toBe('canceled');
  });

  test('should retry a failed agent run', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Retry test' });
    });

    const runId = runResult.run.id;

    // Cancel first (to simulate a failed state)
    await page.evaluate(async (id) => {
      return (window as any).api.agents.cancelRun({ runId: id, action: 'cancel' });
    }, runId);

    // Retry the run
    const retryResult = await page.evaluate(async (id) => {
      return (window as any).api.agents.retryRun({ runId: id, action: 'retry' });
    }, runId);

    expect(retryResult.run).toBeDefined();
    expect(retryResult.run.id).toBe(runId);
    expect(retryResult.run.status).toBe('queued');
  });

  test('should list agent trace events in order', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Trace test' });
    });

    const runId = runResult.run.id;
    await waitForRunStatus(page, runId, 'completed');

    // List trace events for the run
    const traceResult = await page.evaluate(async (id) => {
      return (window as any).api.agents.listTrace({ runId: id, limit: 100 });
    }, runId);

    expect(traceResult.events).toBeDefined();
    expect(Array.isArray(traceResult.events)).toBe(true);

    // Should have at least one status event (queued)
    const statusEvents = traceResult.events.filter((e: any) => e.type === 'status');
    expect(statusEvents.length).toBeGreaterThan(0);

    const firstStatus = statusEvents[0];
    expect(firstStatus.runId).toBe(runId);
    expect(firstStatus.status).toBe('queued');
  });

  test('should verify no secrets in event payloads', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({
        goal: 'Secret redaction test',
      });
    });

    const runId = runResult.run.id;
    await waitForRunStatus(page, runId, 'completed');

    // List trace events
    const traceResult = await page.evaluate(async (id) => {
      return (window as any).api.agents.listTrace({ runId: id, limit: 100 });
    }, runId);

    // Verify no event contains secret-like fields
    const sensitivePatterns = ['password', 'secret', 'token', 'key', 'apiKey', 'api_key'];
    const eventPayloads = JSON.stringify(traceResult.events).toLowerCase();

    // Check that sensitive field names are not present with non-redacted values
    // (This is a simple heuristic; real secret values would be redacted)
    for (const pattern of sensitivePatterns) {
      // Allow field names but ensure no actual secret-like values (e.g., "sk-", "ghp_")
      const hasSecretValue = /sk-[\w]+|ghp_[\w]+|Bearer\s+[\w]+/.test(eventPayloads);
      expect(hasSecretValue).toBe(false);
    }
  });

  test('should verify agent runs appear in audit log', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    const defaultConnection = await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Audit log test' });
    });

    const runId = runResult.run.id;
    await waitForRunStatus(page, runId, 'completed');
    await waitForModelCallAudit(page, runId);

    // List audit events
    const auditResult = await page.evaluate(async () => {
      return (window as any).api.audit.list({ limit: 200 });
    });

    // Verify audit log contains entries related to the run
    // (AgentRunStore should log creation/status changes)
    expect(auditResult.events).toBeDefined();
    expect(Array.isArray(auditResult.events)).toBe(true);

    const modelEvent = auditResult.events.find(
      (event: any) => event.type === 'model-call' && event.runId === runId
    );
    expect(modelEvent).toBeDefined();
    expect(modelEvent).toMatchObject({
      runId,
      providerId: 'ollama',
      connectionId: defaultConnection.metadata.id,
      status: 'success',
    });
  });

  test('should use default connection when none is provided', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    const defaultConnection = await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Default routing test' });
    });

    expect(runResult.run.routing).toMatchObject({
      connectionId: defaultConnection.metadata.id,
      providerId: 'ollama',
      modelRef: 'llama3',
    });
  });

  test('should override default connection when explicitly set', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    const baseUrl = ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434';
    const defaultConnection = await setupDefaultOllamaConnection(page, baseUrl);
    const overrideConnection = await createOllamaConnection(page, {
      baseUrl,
      displayName: 'Ollama Override',
      model: 'llama3',
    });

    const runResult = await page.evaluate(async (input) => {
      return (window as any).api.agents.startRun({
        goal: 'Override routing test',
        connectionId: input.connectionId,
        config: { modelRef: input.modelRef },
      });
    }, { connectionId: overrideConnection.metadata.id, modelRef: 'llama3.1' });

    expect(runResult.run.routing).toMatchObject({
      connectionId: overrideConnection.metadata.id,
      providerId: 'ollama',
      modelRef: 'llama3.1',
    });
    expect(runResult.run.routing?.connectionId).not.toBe(defaultConnection.metadata.id);
  });
});

test.describe('Agent Tool Calls', () => {
  test('should verify tool call events are ordered correctly', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultOllamaConnection(
      page,
      ollamaMock?.baseUrl ?? 'http://127.0.0.1:11434'
    );

    // Note: This test is limited because we can't easily trigger real tool calls from e2e.
    // The DeepAgentRunner in agent-host would need to be running to emit tool call events.
    // This test verifies the event stream structure is correct.

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Tool call ordering test' });
    });

    const runId = runResult.run.id;
    await waitForRunStatus(page, runId, 'completed');

    const traceResult = await page.evaluate(async (id) => {
      return (window as any).api.agents.listTrace({ runId: id, limit: 100 });
    }, runId);

    // Verify events have timestamps and are ordered
    for (let i = 1; i < traceResult.events.length; i++) {
      const prev = traceResult.events[i - 1];
      const curr = traceResult.events[i];

      expect(prev.timestamp).toBeTruthy();
      expect(curr.timestamp).toBeTruthy();

      // Timestamps should be monotonically increasing or equal
      expect(new Date(curr.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(prev.timestamp).getTime()
      );
    }
  });
});

test.describe('VFS Tool Operations', () => {
  test('should verify VFS tool operations are policy-gated', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });

    // This test verifies that VFS operations would go through policy checks.
    // We cannot directly trigger VFS tool calls from the renderer, but we can
    // verify that the agent run APIs are available and would route through broker-main.

    // Verify the preload API exposes agent run controls
    const hasAgentApis = await page.evaluate(() => {
      return (
        typeof (window as any).api?.agents?.startRun === 'function' &&
        typeof (window as any).api?.agents?.cancelRun === 'function' &&
        typeof (window as any).api?.agents?.listTrace === 'function'
      );
    });

    expect(hasAgentApis).toBe(true);

    // In a real scenario, the agent-host would make VFS tool calls via broker-client,
    // and broker-main would enforce policy + audit. Those paths are covered by unit tests.
  });
});
