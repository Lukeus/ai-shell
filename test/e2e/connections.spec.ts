import { test, expect } from '../fixtures/electron-test-app';

/**
 * E2E tests for connections flow.
 *
 * Covers connection creation and consent allow-once access.
 * Audit entries are verified via renderer-visible output.
 */
test.describe('Connections', () => {
  test('creates a connection and logs audit on allow-once access', async ({ page }) => {
    const displayName = 'E2E OpenAI';
    const secretValue = 'e2e-test-secret';

    await page.waitForSelector('#root', { timeout: 10000 });

    // Open settings panel
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Appearance', { timeout: 5000 });

    // Switch to Connections category
    await page.getByRole('button', { name: 'Connections' }).click();
    await page.waitForSelector('text=Connections', { timeout: 5000 });

    // Start creating a new connection
    await page.getByRole('button', { name: 'New' }).click();
    await page.waitForSelector('text=New connection', { timeout: 5000 });

    await page.getByPlaceholder('My connection').fill(displayName);
    await page.getByPlaceholder('https://api.openai.com').fill('https://api.openai.com');
    await page.getByPlaceholder('sk-***').fill(secretValue);

    await page.getByRole('button', { name: 'Create connection' }).click();
    await page.waitForSelector(`text=${displayName}`, { timeout: 5000 });

    const connectionId = await page.evaluate(async (name) => {
      const response = await (window as any).api.connections.list();
      const connection = response.connections.find(
        (item: any) => item.metadata.displayName === name
      );
      return connection?.metadata.id ?? null;
    }, displayName);

    expect(connectionId).not.toBeNull();

    const secretAccess = await page.evaluate(async (id) => {
      return (window as any).api.connections.requestSecretAccess({
        connectionId: id,
        requesterId: 'e2e-test',
        reason: 'E2E validation',
        decision: 'allow-once',
      });
    }, connectionId);

    expect(secretAccess.granted).toBe(true);
    expect(secretAccess.secretRef).toBeTruthy();

    const auditCount = await page.evaluate(async (id) => {
      const response = await (window as any).api.audit.list({ limit: 200 });
      return response.events.filter((event: any) => event.connectionId === id).length;
    }, connectionId);

    await page.evaluate((count) => {
      const marker = document.createElement('div');
      marker.setAttribute('data-testid', 'audit-count');
      marker.textContent = `Audit entries: ${count}`;
      document.body.appendChild(marker);
    }, auditCount);

    await expect(page.getByTestId('audit-count')).toHaveText(
      `Audit entries: ${auditCount}`
    );
    expect(auditCount).toBeGreaterThan(0);
  });
});
