import { test, expect } from '../fixtures/electron-test-app';

test.describe('Search + Source Control panels', () => {
  test('shows Search empty state when no workspace is open', async ({ page }) => {
    await page.waitForSelector('button[aria-label="Search"]', { timeout: 10000 });
    await page.click('button[aria-label="Search"]');

    await expect(page.locator('text=Open a workspace to search files.')).toBeVisible();
  });

  test('shows Source Control empty state when no workspace is open', async ({ page }) => {
    await page.waitForSelector('button[aria-label="Source Control"]', { timeout: 10000 });
    await page.click('button[aria-label="Source Control"]');

    await expect(page.locator('text=Open a workspace to view source control.')).toBeVisible();
  });
});
