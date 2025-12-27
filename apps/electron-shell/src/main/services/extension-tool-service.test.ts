import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionToolService } from './extension-tool-service';
import { ExtensionHostManager } from './extension-host-manager';

describe('ExtensionToolService', () => {
  let toolService: ExtensionToolService;
  let mockExtensionHostManager: ExtensionHostManager;
  let activateExtension: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExtensionHostManager = {
      sendRequest: vi.fn(),
    } as unknown as ExtensionHostManager;

    activateExtension = vi.fn().mockResolvedValue(undefined);
    toolService = new ExtensionToolService(mockExtensionHostManager, activateExtension);
  });

  it('registers and lists tools', () => {
    toolService.registerTool({
      name: 'acme.sample-extension.echo',
      description: 'Echo tool',
      inputSchema: { type: 'object' },
      extensionId: 'acme.sample-extension',
    });

    expect(toolService.hasTool('acme.sample-extension.echo')).toBe(true);
    expect(toolService.listTools()).toHaveLength(1);
  });

  it('executes tools via Extension Host', async () => {
    toolService.registerTool({
      name: 'acme.sample-extension.echo',
      description: 'Echo tool',
      inputSchema: { type: 'object' },
      extensionId: 'acme.sample-extension',
    });
    vi.mocked(mockExtensionHostManager.sendRequest).mockResolvedValue({ ok: true });

    const result = await toolService.executeTool('acme.sample-extension.echo', { message: 'hi' });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ ok: true });
    expect(activateExtension).toHaveBeenCalledWith(
      'acme.sample-extension',
      'onTool:acme.sample-extension.echo'
    );
    expect(mockExtensionHostManager.sendRequest).toHaveBeenCalledWith('tool.execute', {
      toolName: 'acme.sample-extension.echo',
      input: { message: 'hi' },
    });
  });

  it('returns error when tool is missing', async () => {
    const result = await toolService.executeTool('missing.tool', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Tool not found');
  });
});
