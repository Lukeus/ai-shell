import { test, expect } from '../fixtures/electron-test-app';

test.describe('Problems Panel', () => {
  test('renders diagnostics updates', async ({ page }) => {
    await page.evaluate(() => {
      const api = (window as any).api;
      (window as any).__diagnosticsCallbacks = { update: null };

      api.diagnostics.onUpdate = (callback: (event: any) => void) => {
        (window as any).__diagnosticsCallbacks.update = callback;
        return () => {};
      };
    });

    await page.getByRole('tab', { name: 'Problems' }).click();

    await page.evaluate(() => {
      const now = new Date().toISOString();
      (window as any).__diagnosticsCallbacks.update({
        filePath: 'src/main.ts',
        source: 'TypeScript',
        diagnostics: [
          {
            id: '00000000-0000-0000-0000-000000000000',
            severity: 'error',
            message: 'Type mismatch',
            filePath: 'src/main.ts',
            location: {
              startLine: 12,
              startColumn: 5,
              endLine: 12,
              endColumn: 12,
            },
            source: 'TypeScript',
            createdAt: now,
          },
        ],
      });
    });

    await expect(page.getByText('1 error')).toBeVisible();
    await expect(page.getByText('Type mismatch')).toBeVisible();
    await expect(page.getByText('src/main.ts')).toBeVisible();
    await expect(page.getByText('12')).toBeVisible();
    await expect(page.getByText('TypeScript')).toBeVisible();
  });
});
