import { describe, it, expect, beforeEach } from 'vitest';
import { ViewManager } from './view-manager';

describe('ViewManager', () => {
  let manager: ViewManager;

  beforeEach(() => {
    manager = new ViewManager();
  });

  it('registers and renders a view', async () => {
    manager.registerView('sample.view', async () => '<div>ok</div>', 'acme.sample-extension');

    const content = await manager.renderView('sample.view');

    expect(content).toBe('<div>ok</div>');
    expect(manager.hasView('sample.view')).toBe(true);
  });

  it('throws when view is missing', async () => {
    await expect(manager.renderView('missing.view')).rejects.toThrow('View not found');
  });

  it('throws when view provider does not return string', async () => {
    manager.registerView('sample.view', async () => 123 as unknown as string, 'acme.sample-extension');

    await expect(manager.renderView('sample.view')).rejects.toThrow('View provider must return a string');
  });
});
