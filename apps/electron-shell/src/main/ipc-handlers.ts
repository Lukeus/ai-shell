import { registerAgentHandlers } from './ipc/agents';
import { registerAppHandlers } from './ipc/app';
import { registerConnectionsHandlers } from './ipc/connections';
import { registerDiagnosticsHandlers } from './ipc/diagnostics';
import { registerExtensionHandlers } from './ipc/extensions';
import { registerFsHandlers } from './ipc/fs';
import { registerMcpHandlers } from './ipc/mcp';
import { registerOutputHandlers } from './ipc/output';
import { registerScmHandlers } from './ipc/scm';
import { applySddSettings, registerSddHandlers } from './ipc/sdd';
import { registerSearchHandlers } from './ipc/search';
import { registerSettingsHandlers } from './ipc/settings';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerTestOnlyHandlers } from './ipc/testOnly';
import { registerWindowHandlers } from './ipc/window';
import { registerWorkspaceHandlers } from './ipc/workspace';
import { settingsService } from './services/SettingsService';

/**
 * Register all IPC handlers for main process.
 * P6 (Contracts-first): Uses IPC_CHANNELS from api-contracts
 * P1 (Process isolation): Main process owns OS access
 */
export function registerIPCHandlers(): void {
  registerAppHandlers();
  registerSettingsHandlers();
  registerWorkspaceHandlers();
  registerWindowHandlers();
  registerFsHandlers();
  registerSearchHandlers();
  registerScmHandlers();
  registerTerminalHandlers();
  registerOutputHandlers();
  registerSddHandlers();
  void applySddSettings(settingsService.getSettings());
  registerConnectionsHandlers();
  registerAgentHandlers();
  registerDiagnosticsHandlers();
  registerExtensionHandlers();
  registerMcpHandlers();
  registerTestOnlyHandlers();
}
