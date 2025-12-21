import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from './command-manager';

describe('CommandManager', () => {
  let manager: CommandManager;

  beforeEach(() => {
    manager = new CommandManager();
  });

  it('registers and executes a command', async () => {
    manager.registerCommand(
      'sample.hello',
      (name: string) => `Hello ${name}`,
      'acme.sample-extension'
    );

    const result = await manager.executeCommand('sample.hello', ['World']);

    expect(result).toBe('Hello World');
    expect(manager.hasCommand('sample.hello')).toBe(true);
  });

  it('unregisters commands for an extension', () => {
    manager.registerCommand('sample.one', () => 'ok', 'acme.sample-extension');
    manager.registerCommand('sample.two', () => 'ok', 'acme.sample-extension');
    manager.registerCommand('other.one', () => 'ok', 'acme.other');

    manager.unregisterExtensionCommands('acme.sample-extension');

    expect(manager.hasCommand('sample.one')).toBe(false);
    expect(manager.hasCommand('sample.two')).toBe(false);
    expect(manager.hasCommand('other.one')).toBe(true);
  });

  it('throws for unknown command', async () => {
    await expect(manager.executeCommand('missing.command')).rejects.toThrow('Command not found');
  });
});
