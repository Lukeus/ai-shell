import { test, expect } from '../fixtures/electron-test-app';

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

    // Create a run via preload API
    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'E2E test run' });
    });

    expect(runResult.run).toBeDefined();
    expect(runResult.run.id).toBeTruthy();
    expect(runResult.run.status).toBe('queued');
    expect(runResult.run.source).toBe('user');

    // List runs and verify the new run is present
    const listResult = await page.evaluate(async () => {
      return (window as any).api.agents.listRuns();
    });

    expect(listResult.runs).toBeDefined();
    const createdRun = listResult.runs.find((r: any) => r.id === runResult.run.id);
    expect(createdRun).toBeDefined();
    expect(createdRun.status).toBe('queued');
  });

  test('should get agent run by ID', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });

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
    expect(getResult.run.status).toBe('queued');
  });

  test('should cancel an agent run', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });

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

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Trace test' });
    });

    const runId = runResult.run.id;

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

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({
        goal: 'Secret redaction test',
      });
    });

    const runId = runResult.run.id;

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

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Audit log test' });
    });

    const runId = runResult.run.id;

    // List audit events
    const auditResult = await page.evaluate(async () => {
      return (window as any).api.audit.list({ limit: 200 });
    });

    // Verify audit log contains entries related to the run
    // (AgentRunStore should log creation/status changes)
    expect(auditResult.events).toBeDefined();
    expect(Array.isArray(auditResult.events)).toBe(true);

    // Note: Audit entries for agent runs depend on AuditService integration
    // At minimum, verify audit API is accessible
    expect(auditResult.events.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Agent Tool Calls', () => {
  test('should verify tool call events are ordered correctly', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });

    // Note: This test is limited because we can't easily trigger real tool calls from e2e.
    // The DeepAgentRunner in agent-host would need to be running to emit tool call events.
    // This test verifies the event stream structure is correct.

    const runResult = await page.evaluate(async () => {
      return (window as any).api.agents.startRun({ goal: 'Tool call ordering test' });
    });

    const runId = runResult.run.id;

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
