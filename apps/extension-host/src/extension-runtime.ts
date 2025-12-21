/**
 * ExtensionRuntime - Extension API surface wrapper.
 * 
 * This is the API object that extensions receive in their activate() function.
 * Provides controlled access to platform capabilities.
 * 
 * P1 (Process Isolation): All operations proxy through JSON-RPC to main process.
 * NO direct filesystem, network, or OS access.
 */

import { ExtensionContext } from 'packages-api-contracts';
import { JSONRPCClient } from './json-rpc-client';

/**
 * Extension API namespace that extensions can use.
 * This is a minimal stub for Task 5 - will be expanded in later tasks.
 */
export interface ExtensionAPI {
  /** Extension context (ID, paths, etc.) */
  readonly context: ExtensionContext;

  /**
   * Log a message to Extension Host console.
   * Later: this will be proxied to Output channel.
   */
  log(message: string): void;

  /**
   * Get the JSON-RPC client for communicating with main process.
   * Extensions should not use this directly - instead use higher-level API methods.
   * Exposed for advanced use cases only.
   */
  readonly _rpc: JSONRPCClient;
}

/**
 * ExtensionRuntime creates the API object for an extension.
 */
export class ExtensionRuntime {
  private rpcClient: JSONRPCClient;

  constructor(rpcClient: JSONRPCClient) {
    this.rpcClient = rpcClient;
  }

  /**
   * Create Extension API object for an extension.
   * This is passed to the extension's activate() function.
   * 
   * @param context - Extension context
   * @returns Extension API object
   */
  createAPI(context: ExtensionContext): ExtensionAPI {
    const api: ExtensionAPI = {
      context,

      log(message: string): void {
        console.log(`[Extension ${context.extensionId}] ${message}`);
      },

      _rpc: this.rpcClient,
    };

    return api;
  }
}
