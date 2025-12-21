import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionViewService } from './extension-view-service';
import { ExtensionHostManager } from './extension-host-manager';

describe('ExtensionViewService', () => {
  let viewService: ExtensionViewService;
  let mockExtensionHostManager: ExtensionHostManager;

  beforeEach(() => {
    mockExtensionHostManager = {
      sendRequest: vi.fn(),
    } as unknown as ExtensionHostManager;

    viewService = new ExtensionViewService(mockExtensionHostManager);
  });

  it('registers and lists views', () => {
    viewService.registerView({
      viewId: 'sample.view',
      name: 'Sample View',
      location: 'panel',
      extensionId: 'acme.sample-extension',
    });

    expect(viewService.hasView('sample.view')).toBe(true);
    expect(viewService.listViews()).toHaveLength(1);
  });

  it('renders view content via Extension Host', async () => {
    viewService.registerView({
      viewId: 'sample.view',
      name: 'Sample View',
      location: 'panel',
      extensionId: 'acme.sample-extension',
    });
    vi.mocked(mockExtensionHostManager.sendRequest).mockResolvedValue('<div>ok</div>');

    const result = await viewService.renderView('sample.view');

    expect(result.success).toBe(true);
    expect(result.content).toBe('<div>ok</div>');
    expect(mockExtensionHostManager.sendRequest).toHaveBeenCalledWith('view.render', {
      viewId: 'sample.view',
    });
  });

  it('returns error when view is missing', async () => {
    const result = await viewService.renderView('missing.view');

    expect(result.success).toBe(false);
    expect(result.error).toContain('View not found');
  });

  it('returns error when view content is invalid', async () => {
    viewService.registerView({
      viewId: 'sample.view',
      name: 'Sample View',
      location: 'panel',
      extensionId: 'acme.sample-extension',
    });
    vi.mocked(mockExtensionHostManager.sendRequest).mockResolvedValue(123);

    const result = await viewService.renderView('sample.view');

    expect(result.success).toBe(false);
    expect(result.error).toContain('View must return string content');
  });
});
