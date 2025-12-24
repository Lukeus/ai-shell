import fs from 'fs';
import { test, expect } from '../fixtures/electron-test-app';

test.describe('Crash recovery', () => {
  test('recovers from renderer crash and logs diagnostics', async ({ electronApp, page }) => {
    await page.waitForSelector('#root', { timeout: 15000 });

    const crashResult = await page.evaluate(async () => {
      if (!window.api?.test?.forceCrashRenderer) {
        return { ok: false, error: { message: 'Test API not available' } };
      }
      return window.api.test.forceCrashRenderer({});
    });

    expect(crashResult.ok).toBe(true);

    let recoveredPage = page;
    try {
      recoveredPage = await electronApp.waitForEvent('window', { timeout: 5000 });
    } catch {
      // Window likely reloaded instead of being recreated.
    }

    await recoveredPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await recoveredPage.waitForSelector('#root', { timeout: 15000 });

    const logResult = await recoveredPage.evaluate(() => window.api.diagnostics.getLogPath());
    expect(logResult.ok).toBe(true);
    if (!logResult.ok) {
      return;
    }

    const logPath = logResult.value.path;
    let logContent = '';
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
      if (fs.existsSync(logPath)) {
        logContent = fs.readFileSync(logPath, 'utf-8');
        if (logContent.includes('Renderer process gone')) {
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(logContent).toContain('Renderer process gone');
  });
});
