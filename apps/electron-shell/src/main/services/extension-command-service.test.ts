import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionCommandService, type RegisteredCommand } from './extension-command-service';
import { ExtensionHostManager } from './extension-host-manager';

describe('ExtensionCommandService', () => {
  let commandService: ExtensionCommandService;
  let mockExtensionHostManager: ExtensionHostManager;
  let activateExtension: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock Extension Host Manager
    mockExtensionHostManager = {
      sendRequest: vi.fn(),
    } as unknown as ExtensionHostManager;

    activateExtension = vi.fn().mockResolvedValue(undefined);
    commandService = new ExtensionCommandService(mockExtensionHostManager, activateExtension);
  });

  describe('registerCommand', () => {
    it('should register a command', () => {
      const command: RegisteredCommand = {
        commandId: 'test.hello',
        title: 'Hello Command',
        extensionId: 'test.extension',
      };

      commandService.registerCommand(command);

      expect(commandService.hasCommand('test.hello')).toBe(true);
      expect(commandService.getCommand('test.hello')).toEqual(command);
    });

    it('should overwrite existing command', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const command1: RegisteredCommand = {
        commandId: 'test.hello',
        title: 'Hello Command',
        extensionId: 'test.extension1',
      };

      const command2: RegisteredCommand = {
        commandId: 'test.hello',
        title: 'Updated Hello Command',
        extensionId: 'test.extension2',
      };

      commandService.registerCommand(command1);
      commandService.registerCommand(command2);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );
      expect(commandService.getCommand('test.hello')?.extensionId).toBe('test.extension2');

      consoleSpy.mockRestore();
    });
  });

  describe('unregisterExtensionCommands', () => {
    it('should unregister all commands from an extension', () => {
      commandService.registerCommand({
        commandId: 'test.command1',
        title: 'Command 1',
        extensionId: 'test.extension',
      });

      commandService.registerCommand({
        commandId: 'test.command2',
        title: 'Command 2',
        extensionId: 'test.extension',
      });

      commandService.registerCommand({
        commandId: 'other.command',
        title: 'Other Command',
        extensionId: 'other.extension',
      });

      commandService.unregisterExtensionCommands('test.extension');

      expect(commandService.hasCommand('test.command1')).toBe(false);
      expect(commandService.hasCommand('test.command2')).toBe(false);
      expect(commandService.hasCommand('other.command')).toBe(true);
    });
  });

  describe('executeCommand', () => {
    it('should return error for unknown command', async () => {
      const result = await commandService.executeCommand('unknown.command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command not found');
    });

    it('should execute command via Extension Host', async () => {
      const mockResult = { data: 'success' };
      vi.mocked(mockExtensionHostManager.sendRequest).mockResolvedValue(mockResult);

      commandService.registerCommand({
        commandId: 'test.hello',
        title: 'Hello Command',
        extensionId: 'test.extension',
      });

      const result = await commandService.executeCommand('test.hello', ['arg1', 'arg2']);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockResult);
      expect(activateExtension).toHaveBeenCalledWith('test.extension', 'onCommand:test.hello');
      expect(mockExtensionHostManager.sendRequest).toHaveBeenCalledWith('command.execute', {
        commandId: 'test.hello',
        args: ['arg1', 'arg2'],
      });
    });

    it('should handle command execution errors', async () => {
      vi.mocked(mockExtensionHostManager.sendRequest).mockRejectedValue(
        new Error('Execution failed')
      );

      commandService.registerCommand({
        commandId: 'test.hello',
        title: 'Hello Command',
        extensionId: 'test.extension',
      });

      const result = await commandService.executeCommand('test.hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should timeout after 5 seconds', async () => {
      // Mock sendRequest to never resolve
      vi.mocked(mockExtensionHostManager.sendRequest).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      commandService.registerCommand({
        commandId: 'test.slow',
        title: 'Slow Command',
        extensionId: 'test.extension',
      });

      const result = await commandService.executeCommand('test.slow');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 6000); // Test timeout longer than command timeout
  });

  describe('listCommands', () => {
    it('should list all registered commands', () => {
      commandService.registerCommand({
        commandId: 'test.command1',
        title: 'Command 1',
        extensionId: 'test.extension',
      });

      commandService.registerCommand({
        commandId: 'test.command2',
        title: 'Command 2',
        extensionId: 'test.extension',
      });

      const commands = commandService.listCommands();

      expect(commands).toHaveLength(2);
      expect(commands.map((c) => c.commandId)).toEqual(['test.command1', 'test.command2']);
    });

    it('should return empty array when no commands registered', () => {
      const commands = commandService.listCommands();
      expect(commands).toHaveLength(0);
    });
  });
});
