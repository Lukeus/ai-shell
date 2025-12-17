import { test, expect } from '../fixtures/electron-test-app';

/**
 * E2E smoke tests for ai-shell Electron app.
 * P1 (Process isolation): Verify renderer cannot access Node.js
 * P2 (Security defaults): Verify contextIsolation works
 * 
 * Note: These tests require the electron-shell app to be built first.
 * Run: pnpm --filter apps-electron-shell build
 * Or keep dev server running: pnpm dev
 */

test.describe('Electron App Launch', () => {
  test('should launch and display version info', async ({ page }) => {
    // Wait for the root div to be populated (React renders into #root)
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Wait for React content to render - check for either h1 or the version info text
    const hasHeading = await page.locator('h1').count() > 0;
    const hasVersionInfo = await page.locator('text=/App:|Electron:|Chrome:|Node:/').count() > 0;
    
    // If neither is present, log what's actually rendered for debugging
    if (!hasHeading && !hasVersionInfo) {
      const bodyContent = await page.content();
      console.log('Page content:', bodyContent);
    }

    // Verify heading is present
    await page.waitForSelector('h1:has-text("ai-shell")', { timeout: 15000 });
    const heading = await page.textContent('h1');
    expect(heading).toBe('ai-shell');

    // Verify version info is displayed (wait for IPC call to complete)
    // Look for any of the version labels
    await page.waitForSelector('text=/App:|Electron:/', { timeout: 10000 });

    // Check that all version fields are present
    const versionText = await page.textContent('body');
    expect(versionText).toContain('App:');
    expect(versionText).toContain('Electron:');
    expect(versionText).toContain('Chrome:');
    expect(versionText).toContain('Node:');
  });
});

test.describe('Security - Process Isolation', () => {
  test('renderer should not have access to Node.js globals', async ({ page }) => {
    // P1 (Process isolation): Renderer must be sandboxed
    // P2 (Security defaults): contextIsolation must prevent Node.js access
    
    // Evaluate in renderer context
    const hasProcess = await page.evaluate(() => typeof (window as any).process !== 'undefined');
    const hasRequire = await page.evaluate(() => typeof (window as any).require !== 'undefined');
    const has__dirname = await page.evaluate(() => typeof (window as any).__dirname !== 'undefined');
    const has__filename = await page.evaluate(() => typeof (window as any).__filename !== 'undefined');

    // All Node.js globals should be undefined in renderer
    expect(hasProcess).toBe(false);
    expect(hasRequire).toBe(false);
    expect(has__dirname).toBe(false);
    expect(has__filename).toBe(false);
  });

  test('renderer should have access to window.api', async ({ page }) => {
    // Verify preload script exposed window.api correctly
    const hasApi = await page.evaluate(() => typeof (window as any).api !== 'undefined');
    const hasGetVersion = await page.evaluate(() => typeof (window as any).api?.getVersion === 'function');

    expect(hasApi).toBe(true);
    expect(hasGetVersion).toBe(true);

    // Verify getVersion returns a Promise with version data
    const versionInfo = await page.evaluate(() => (window as any).api.getVersion());
    expect(versionInfo).toHaveProperty('version');
    expect(versionInfo).toHaveProperty('electronVersion');
    expect(versionInfo).toHaveProperty('chromeVersion');
    expect(versionInfo).toHaveProperty('nodeVersion');
  });
});
