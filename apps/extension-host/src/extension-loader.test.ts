import { describe, it, expect, beforeEach } from 'vitest';
import { ExtensionLoader } from './extension-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '../../../test/fixtures/extensions');

describe('ExtensionLoader', () => {
  let loader: ExtensionLoader;

  beforeEach(() => {
    loader = new ExtensionLoader();
  });

  it('loads an extension module from disk', async () => {
    const extensionPath = path.join(fixturesRoot, 'sample-extension');
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf8')
    );

    const loaded = await loader.loadExtension(manifest, extensionPath);

    expect(loaded.manifest.id).toBe('acme.sample-extension');
    expect(loaded.extensionPath).toBe(extensionPath);
    expect(loader.isLoaded('acme.sample-extension')).toBe(true);
    expect(loader.getLoadedExtension('acme.sample-extension')).toBeDefined();
  });

  it('throws when activate() is missing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-no-activate-'));
    const manifest = {
      id: 'acme.no-activate',
      name: 'no-activate',
      version: '1.0.0',
      publisher: 'acme',
      main: 'index.js',
      activationEvents: ['onStartup'],
      permissions: ['ui'],
    };

    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(tempDir, 'index.js'), 'module.exports = {};', 'utf8');

    await expect(loader.loadExtension(manifest, tempDir)).rejects.toThrow(
      'does not export an activate() function'
    );
  });
});
