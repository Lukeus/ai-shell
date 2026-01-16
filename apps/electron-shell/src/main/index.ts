import { app, BrowserWindow } from 'electron';
import { registerMainIpcHandlers, wireTerminalEvents } from './bootstrap/ipc';
import { initializeAgentHost } from './bootstrap/agent-host';
import {
  getAgentHostManager,
  getExtensionHostManager,
} from './bootstrap/host-context';
import {
  initializeExtensionHost,
  initializeExtensionInfrastructure,
} from './bootstrap/extension-host';
import { resolveAgentHostPath, resolveExtensionHostPath } from './bootstrap/paths';
import { createMainWindow, showSafeModeDialog } from './bootstrap/window';
import { installGlobalErrorHandlers } from './global-errors';
import { buildApplicationMenu } from './menu';
import { runtimeStateService } from './services/RuntimeStateService';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';
import { terminalService } from './services/TerminalService';
import { workspaceService } from './services/WorkspaceService';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not available (e.g. in test environment)
}

let stableRunTimer: NodeJS.Timeout | null = null;
let isAppQuitting = false;

const STABLE_RUN_DELAY_MS = 120_000;

installGlobalErrorHandlers();

const createWindow = (): void => {
  createMainWindow({
    shouldRecover: () => !isAppQuitting,
  });
};

// P1 (Process isolation): Main process handles app lifecycle
app.on('ready', () => {
  const runtimeState = runtimeStateService.getState();
  const safeModeEnabled = runtimeState.safeMode;

  registerMainIpcHandlers();
  wireTerminalEvents();

  const extensionInfrastructure = initializeExtensionInfrastructure(app.getPath('userData'));
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (!safeModeEnabled && !isTestEnv) {
    const extensionHostPath = resolveExtensionHostPath();
    const extensionRuntime = initializeExtensionHost({
      extensionHostPath,
      infrastructure: extensionInfrastructure,
      workspaceService,
    });

    const agentHostPath = resolveAgentHostPath();
    initializeAgentHost({
      agentHostPath,
      getExtensionToolService: () => extensionRuntime.extensionToolService,
    });

    void extensionRuntime.start();
  } else if (isTestEnv) {
    console.warn('[Main] Test environment: extension and agent hosts are disabled.');
  } else {
    console.warn('[Main] Safe Mode enabled: extension and agent hosts are disabled.');
  }

  buildApplicationMenu();
  createWindow();

  if (safeModeEnabled) {
    void showSafeModeDialog();
  }

  stableRunTimer = setTimeout(() => {
    runtimeStateService.markStableRun();
  }, STABLE_RUN_DELAY_MS);
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  isAppQuitting = true;
  if (stableRunTimer) {
    clearTimeout(stableRunTimer);
    stableRunTimer = null;
  }

  terminalService.cleanup();
  sddWatcher.stop();
  void sddTraceService.abortActiveRun('system').catch(() => undefined);

  const extensionHostManager = getExtensionHostManager();
  if (extensionHostManager) {
    extensionHostManager.stop().catch((error) => {
      console.error('[Main] Error stopping Extension Host:', error);
    });
  }

  const agentHostManager = getAgentHostManager();
  if (agentHostManager) {
    agentHostManager.stop().catch((error) => {
      console.error('[Main] Error stopping Agent Host:', error);
    });
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isAppQuitting = true;
  if (stableRunTimer) {
    clearTimeout(stableRunTimer);
    stableRunTimer = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

export {
  getExtensionCommandService,
  getExtensionRegistry,
  getPermissionService,
  getExtensionViewService,
  getExtensionToolService,
  getAgentHostManager,
  getMcpToolBridge,
} from './bootstrap/host-context';
