import { describe, it, expect } from 'vitest';
import { ExtensionRuntime } from './extension-runtime';
import type { ExtensionContext } from 'packages-api-contracts';

describe('ExtensionRuntime', () => {
  it('creates an API with context and rpc client', () => {
    const rpcClient = {} as any;
    const runtime = new ExtensionRuntime(rpcClient);
    const context: ExtensionContext = {
      extensionId: 'acme.sample-extension',
      extensionPath: '/tmp/sample',
      globalStoragePath: '/tmp/storage',
    };

    const api = runtime.createAPI(context);

    expect(api.context).toEqual(context);
    expect(api._rpc).toBe(rpcClient);
  });
});
