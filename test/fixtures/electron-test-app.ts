import { test as base, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import type { ElectronApplication } from 'playwright';
import path from 'path';
import { existsSync } from 'fs';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

/**
 * Reusable fixture for launching Electron app in tests.
 * Provides access to electronApp and the first window's page.
 * 
 * Requires the app to be packaged first: pnpm --filter apps-electron-shell build
 */
export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Use the packaged Electron app from out directory
    const executablePath = path.join(
      __dirname,
      '../../apps/electron-shell/out/apps-electron-shell-win32-x64/apps-electron-shell.exe'
    );

    if (!existsSync(executablePath)) {
      throw new Error(
        `Packaged app not found. Run: pnpm --filter apps-electron-shell build`
      );
    }

    const app = await electron.launch({
      executablePath,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    // Wait for the first window and get its page
    const window = await electronApp.firstWindow();
    await use(window);
  },
});

export { expect } from '@playwright/test';
