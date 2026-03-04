import fs from 'fs';
import os from 'os';
import path from 'path';
import { test as base, expect, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

type AgentSkillsFixtures = {
  sandboxDir: string;
  userDataDir: string;
  electronApp: ElectronApplication;
  page: Page;
};

const FIXTURE_EXTENSION_DIR = path.resolve(
  __dirname,
  '../fixtures/extensions/skill-extension'
);
const EXECUTABLE_PATH = path.resolve(
  __dirname,
  '../../apps/electron-shell/out/apps-electron-shell-win32-x64/apps-electron-shell.exe'
);

const seedFixtureExtension = (userDataDir: string): void => {
  const extensionsDir = path.join(userDataDir, 'extensions');
  const destination = path.join(extensionsDir, 'skill-extension');
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.cpSync(FIXTURE_EXTENSION_DIR, destination, {
    recursive: true,
    force: true,
  });
};

const setupDefaultConnection = async (page: Page): Promise<string> => {
  return page.evaluate(async () => {
    const api = (window as any).api;
    const created = await api.connections.create({
      providerId: 'ollama',
      scope: 'user',
      displayName: 'E2E Ollama',
      config: {
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llama3',
      },
    });
    await api.updateSettings({
      agents: { defaultConnectionId: created.connection.metadata.id },
    });
    return created.connection.metadata.id as string;
  });
};

const test = base.extend<AgentSkillsFixtures>({
  sandboxDir: async ({}, use) => {
    const sandboxDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ai-shell-agent-skills-e2e-')
    );
    await use(sandboxDir);
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  },

  userDataDir: async ({ sandboxDir }, use) => {
    const userDataDir = path.join(sandboxDir, 'user-data');
    fs.mkdirSync(userDataDir, { recursive: true });
    seedFixtureExtension(userDataDir);
    await use(userDataDir);
  },

  electronApp: async ({ userDataDir }, use) => {
    if (!fs.existsSync(EXECUTABLE_PATH)) {
      throw new Error(
        'Packaged app not found. Run: pnpm --filter apps-electron-shell build'
      );
    }

    const env = {
      ...process.env,
      NODE_ENV: 'test',
    } as Record<string, string | undefined>;
    delete env.ELECTRON_RUN_AS_NODE;

    const electronApp = await electron.launch({
      executablePath: EXECUTABLE_PATH,
      args: [`--user-data-dir=${userDataDir}`],
      env: env as Record<string, string>,
    });

    await use(electronApp);
    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

test.describe('agent skills', () => {
  test('agent skills: create skill, set default, and last-used override run metadata', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultConnection(page);

    const suffix = Date.now().toString(36);
    const defaultSkillId = `skill.e2e.default.${suffix}`;
    const lastUsedSkillId = `skill.e2e.last.${suffix}`;

    const result = await page.evaluate(
      async ({ nextDefaultSkillId, nextLastUsedSkillId }) => {
        const api = (window as any).api;

        await api.skills.create({
          scope: 'global',
          skill: {
            id: nextDefaultSkillId,
            name: 'E2E Default Skill',
            promptTemplate: 'Use the default skill behavior.',
          },
        });

        await api.skills.create({
          scope: 'global',
          skill: {
            id: nextLastUsedSkillId,
            name: 'E2E Last Used Skill',
            promptTemplate: 'Use the last used skill behavior.',
          },
        });

        await api.skills.setDefault({ scope: 'global', skillId: nextDefaultSkillId });
        await api.skills.setLastUsed({ scope: 'global', skillId: nextLastUsedSkillId });

        const started = await api.agents.startRun({
          goal: 'agent skills default vs last-used',
        });
        const listed = await api.skills.list({ scope: 'global' });

        return {
          run: started.run,
          preferences: listed.preferences,
        };
      },
      {
        nextDefaultSkillId: defaultSkillId,
        nextLastUsedSkillId: lastUsedSkillId,
      }
    );

    expect(result.run.skill?.skillId).toBe(lastUsedSkillId);
    expect(result.run.skill?.source).toBe('user');
    expect(result.run.skill?.scope).toBe('global');
    expect(result.preferences?.defaultSkillId).toBe(defaultSkillId);
    expect(result.preferences?.lastUsedSkillId).toBe(lastUsedSkillId);
  });

  test('agent skills: workspace skill overrides global skill with same id', async ({
    sandboxDir,
    userDataDir,
    page,
  }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultConnection(page);

    const workspacePath = path.join(sandboxDir, 'workspace-repo');
    const workspaceFilePath = path.join(userDataDir, 'workspace.json');
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.writeFileSync(
      workspaceFilePath,
      JSON.stringify(
        {
          path: workspacePath,
          name: path.basename(workspacePath),
        },
        null,
        2
      ),
      'utf-8'
    );

    await page.waitForFunction(
      async (expectedWorkspacePath) => {
        const workspace = await (window as any).api.workspace.getCurrent();
        return workspace?.path === expectedWorkspacePath;
      },
      workspacePath
    );

    const skillId = `skill.e2e.override.${Date.now().toString(36)}`;
    const result = await page.evaluate(async (overrideSkillId) => {
      const api = (window as any).api;

      await api.skills.create({
        scope: 'global',
        skill: {
          id: overrideSkillId,
          name: 'Global Override Skill',
          promptTemplate: 'Use global skill behavior.',
        },
      });
      await api.skills.setDefault({ scope: 'global', skillId: overrideSkillId });

      await api.skills.create({
        scope: 'workspace',
        skill: {
          id: overrideSkillId,
          name: 'Workspace Override Skill',
          promptTemplate: 'Use workspace override behavior.',
        },
      });

      const workspaceSkills = await api.skills.list({ scope: 'workspace' });
      const started = await api.agents.startRun({
        goal: 'agent skills workspace override',
      });

      return {
        run: started.run,
        workspaceSkill: workspaceSkills.skills.find(
          (skill: any) => skill.definition.id === overrideSkillId
        ),
      };
    }, skillId);

    expect(result.workspaceSkill?.definition.name).toBe('Workspace Override Skill');
    expect(result.workspaceSkill?.scope).toBe('workspace');
    expect(result.run.skill?.skillId).toBe(skillId);
    expect(result.run.skill?.scope).toBe('workspace');
  });

  test('agent skills: extension-contributed skill appears and is selectable', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    await setupDefaultConnection(page);

    const extensionSkillId = 'skill.fixture.extension';

    await page.waitForFunction(
      async (nextExtensionSkillId) => {
        const response = await (window as any).api.skills.list({ scope: 'global' });
        return response.skills.some(
          (skill: any) =>
            skill.definition.id === nextExtensionSkillId && skill.source === 'extension'
        );
      },
      extensionSkillId
    );

    const result = await page.evaluate(async (nextExtensionSkillId) => {
      const api = (window as any).api;
      const listed = await api.skills.list({ scope: 'global' });
      const extensionSkill = listed.skills.find(
        (skill: any) => skill.definition.id === nextExtensionSkillId
      );
      const started = await api.agents.startRun({
        goal: 'agent skills extension selection',
        skillId: nextExtensionSkillId,
      });

      return {
        extensionSkill,
        run: started.run,
      };
    }, extensionSkillId);

    expect(result.extensionSkill).toBeDefined();
    expect(result.extensionSkill.extensionId).toBe('e2e.skill-extension');
    expect(result.extensionSkill.source).toBe('extension');
    expect(result.run.skill?.skillId).toBe(extensionSkillId);
    expect(result.run.skill?.source).toBe('extension');
    expect(result.run.skill?.scope).toBe('global');
  });
});
