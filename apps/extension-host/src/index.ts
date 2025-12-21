#!/usr/bin/env node
/**
 * Extension Host - Isolated process for running untrusted extension code.
 * 
 * P1 (Process Isolation): Runs as separate Node.js process, NOT part of Electron.
 * All communication with main process via JSON-RPC over stdio.
 * NO direct filesystem, network, or OS access - all operations proxied through main.
 */

import { JSONRPCClient } from './json-rpc-client';
import { ExtensionLoader } from './extension-loader';
import { ActivationController } from './activation-controller';
import { ContributionRegistry } from './contribution-registry';
import { ExtensionRuntime } from './extension-runtime';
import { CommandManager } from './command-manager';
import { ViewManager } from './view-manager';
import { ToolManager } from './tool-manager';
import { ErrorHandler } from './error-handler';
import { ExtensionManifest, ExtensionContext } from 'packages-api-contracts';

/**
 * Extension Host entry point.
 * Initializes JSON-RPC communication and waits for commands from main process.
 */
async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Extension Host - Isolated process for running extensions');
    console.log('Usage: node index.js [options]');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('  --version, -v  Show version information');
    console.log('');
    console.log('Note: This process is designed to be spawned by the main process.');
    console.log('It communicates via JSON-RPC over stdin/stdout.');
    process.exit(0);
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    console.log('Extension Host v0.0.1');
    process.exit(0);
  }

  // Initialize ErrorHandler first
  // Task 9: Global error handling to prevent Extension Host crashes
  const errorHandler = new ErrorHandler();
  
  // Initialize JSON-RPC client for stdio communication
  const rpcClient = new JSONRPCClient();
  
  // Report errors to main process via JSON-RPC
  errorHandler.onError((error, context) => {
    try {
      rpcClient.sendNotification('error.report', {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      });
    } catch (notificationError) {
      console.error('[Extension Host] Failed to report error to main:', notificationError);
    }
  });

  // Initialize extension system components
  const loader = new ExtensionLoader();
  const activationController = new ActivationController(loader);
  const contributionRegistry = new ContributionRegistry();
  const extensionRuntime = new ExtensionRuntime(rpcClient);
  const commandManager = new CommandManager();
  const viewManager = new ViewManager();
  const toolManager = new ToolManager();

  // JSON-RPC method handlers
  
  // Register extension: main process sends manifest + path
  rpcClient.onRequest('extension.register', async (params: unknown) => {
    const { manifest, extensionPath } = params as { manifest: ExtensionManifest; extensionPath: string };
    activationController.registerExtension(manifest, extensionPath);
    contributionRegistry.registerContributions(manifest);
    return { success: true };
  });

  // Activate extension: main process triggers activation
  rpcClient.onRequest('extension.activate', async (params: unknown) => {
    const { extensionId, context } = params as { extensionId: string; context: ExtensionContext };
    const api = extensionRuntime.createAPI(context);
    
    // Temporarily add API to context for extension to use
    // TODO: Better way to pass API to extension
    (context as unknown as { api: unknown }).api = api;
    
    await activationController.activateExtension(extensionId, context);
    return { success: true };
  });

  // Deactivate extension
  rpcClient.onRequest('extension.deactivate', async (params: unknown) => {
    const { extensionId } = params as { extensionId: string };
    await activationController.deactivateExtension(extensionId);
    return { success: true };
  });

  // Get extension state
  rpcClient.onRequest('extension.getState', (params: unknown) => {
    const { extensionId } = params as { extensionId: string };
    const state = activationController.getExtensionState(extensionId);
    return { state };
  });

  // Get all active extensions
  rpcClient.onRequest('extension.getActive', () => {
    const active = activationController.getActiveExtensions();
    return { extensions: active };
  });

  // Get all commands
  rpcClient.onRequest('contributions.getCommands', () => {
    const commands = contributionRegistry.getAllCommands();
    return { commands };
  });

  // Get all views
  rpcClient.onRequest('contributions.getViews', () => {
    const views = contributionRegistry.getAllViews();
    return { views };
  });

  // Get all tools
  rpcClient.onRequest('contributions.getTools', () => {
    const tools = contributionRegistry.getAllTools();
    return { tools };
  });

  // Execute command
  rpcClient.onRequest('command.execute', async (params: unknown) => {
    const { commandId, args } = params as { commandId: string; args: unknown[] };
    const result = await commandManager.executeCommand(commandId, args);
    return result;
  });

  // Render view
  rpcClient.onRequest('view.render', async (params: unknown) => {
    const { viewId } = params as { viewId: string };
    const content = await viewManager.renderView(viewId);
    return content;
  });

  // Execute tool
  rpcClient.onRequest('tool.execute', async (params: unknown) => {
    const { toolName, input } = params as { toolName: string; input: unknown };
    const result = await toolManager.executeTool(toolName, input);
    return result;
  });

  // Set up graceful shutdown
  const shutdown = async () => {
    console.error('[Extension Host] Shutting down...');
    errorHandler.setShuttingDown(true);
    
    // Deactivate all active extensions
    const active = activationController.getActiveExtensions();
    for (const extensionId of active) {
      try {
        await activationController.deactivateExtension(extensionId);
      } catch (error) {
        console.error(`[Extension Host] Error deactivating ${extensionId}:`, error);
      }
    }
    
    rpcClient.close();
    process.exit(0);
  };

  // ErrorHandler already sets up SIGINT and SIGTERM handlers
  // But we need to call our shutdown function
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.error('[Extension Host] Started and ready for JSON-RPC communication');
  
  // Keep process alive - it will receive commands via stdin
  // The JSONRPCClient handles all incoming messages
}

// Start the Extension Host
main().catch((error) => {
  console.error('[Extension Host] Fatal error during startup:', error);
  process.exit(1);
});
