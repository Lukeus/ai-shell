import { describe, it, expect } from 'vitest';
import { ExtensionRuntime } from './extension-runtime';
import type { ExtensionContext } from 'packages-api-contracts';
import { CommandManager } from './command-manager';
import { ViewManager } from './view-manager';
import { ToolManager } from './tool-manager';

describe('ExtensionRuntime', () => {
  it('creates an API with context and registration helpers', () => {
    const runtime = new ExtensionRuntime(
      new CommandManager(),
      new ViewManager(),
      new ToolManager()
    );
    const context: ExtensionContext = {
      extensionId: 'acme.sample-extension',
      extensionPath: '/tmp/sample',
      globalStoragePath: '/tmp/storage',
    };

    const api = runtime.createAPI(context);

    expect(api.context).toEqual(context);
    expect(typeof api.commands.registerCommand).toBe('function');
    expect(typeof api.views.registerView).toBe('function');
    expect(typeof api.tools.registerTool).toBe('function');
  });
});
