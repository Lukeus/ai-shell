import { test, expect } from '../fixtures/electron-test-app';

test.describe('Terminal Panel', () => {
  test('creates a terminal session and renders xterm', async ({ page }) => {
    await page.getByRole('tab', { name: 'Terminal' }).click();

    const newButton = page.getByRole('button', { name: 'New' });
    await newButton.click();

    await expect(page.getByRole('button', { name: 'Terminal 1' })).toBeVisible();
    await page.waitForSelector('.xterm', { timeout: 15000 });
  });

  test('creates multiple sessions and allows switching', async ({ page }) => {
    await page.getByRole('tab', { name: 'Terminal' }).click();

    const newButton = page.getByRole('button', { name: 'New' });
    await newButton.click();
    await newButton.click();

    const sessionTabs = page.getByRole('button', { name: /Terminal \d/ });
    await expect(sessionTabs).toHaveCount(2);

    await sessionTabs.nth(1).click();
    await expect(sessionTabs.nth(1)).toBeVisible();
  });
});
