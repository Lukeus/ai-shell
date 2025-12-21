import { test, expect } from '../fixtures/electron-test-app';

test('extensions panel loads empty state', async ({ page }) => {
  await page.getByRole('button', { name: 'Extensions' }).click();

  await expect(page.getByText('No extensions found.')).toBeVisible();
});
