import { test, expect } from '../fixtures/electron-test-app';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Output Panel', () => {
  test('renders output channel and appends lines', async ({ page }) => {
    await page.evaluate(() => {
      const api = (window as any).api;
      const now = new Date().toISOString();
      const channel = {
        id: 'build',
        name: 'Build',
        lineCount: 2,
        createdAt: now,
      };
      const lines = [
        {
          lineNumber: 1,
          content: 'Build started',
          timestamp: now,
          severity: 'info',
        },
        {
          lineNumber: 2,
          content: 'Compiling modules...',
          timestamp: now,
          severity: 'info',
        },
      ];

      (window as any).__outputCallbacks = { append: null, clear: null };

      api.output.listChannels = async () => ({ channels: [channel] });
      api.output.read = async () => ({
        channel,
        lines,
        totalLines: lines.length,
        hasMore: false,
      });
      api.output.onAppend = (callback: (event: any) => void) => {
        (window as any).__outputCallbacks.append = callback;
        return () => {};
      };
      api.output.onClear = (callback: (event: any) => void) => {
        (window as any).__outputCallbacks.clear = callback;
        return () => {};
      };
    });

    await page.getByRole('tab', { name: 'Output' }).click();

    await expect(page.locator('select')).toHaveValue('build');
    await expect(page.getByText('Build started')).toBeVisible();

    await page.evaluate(() => {
      const now = new Date().toISOString();
      (window as any).__outputCallbacks.append({
        channelId: 'build',
        lines: [
          {
            lineNumber: 3,
            content: 'Build finished',
            timestamp: now,
            severity: 'info',
          },
        ],
      });
    });

    await expect(page.getByText('Build finished')).toBeVisible();

    if (process.env.CAPTURE_SCREENSHOTS) {
      const outputPath = path.join('docs', 'screenshots', 'output-panel.png');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      await page.screenshot({ path: outputPath, fullPage: true });
    }
  });
});
