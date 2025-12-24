import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerIPCHandlers } from './ipc-handlers';
import { buildApplicationMenu } from './menu';
import { attachWindowCrashRecovery, installGlobalErrorHandlers } from './global-errors';
import { terminalService } from './services/TerminalService';
import { sddTraceService } from './services/SddTraceService';
import { sddWatcher } from './services/SddWatcher';
import { runtimeStateService } from './services/RuntimeStateService';
import { ExtensionHostManager } from './services/extension-host-manager';
import { ExtensionRegistry } from './services/extension-registry';
import { ExtensionCommandService } from './services/extension-command-service';
import { ExtensionViewService } from './services/extension-view-service';
import { ExtensionToolService } from './services/extension-tool-service';
import { PermissionService } from './services/permission-service';
import { ExtensionStateManager } from './services/extension-state-manager';
import { AgentHostManager } from './services/agent-host-manager';
import { auditService } from './services/AuditService';
import * as brokerMainModule from 'packages-broker-main';
import { IPC_CHANNELS } from 'packages-api-contracts';
// SettingsService is initialized lazily when first accessed via IPC handlers

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not available (e.g. in test environment)
}

let mainWindow: BrowserWindow | null = null;
let extensionHostManager: ExtensionHostManager | null = null;
let extensionRegistry: ExtensionRegistry | null = null;
let extensionCommandService: ExtensionCommandService | null = null;
let extensionViewService: ExtensionViewService | null = null;
let extensionToolService: ExtensionToolService | null = null;
let permissionService: PermissionService | null = null;
let extensionStateManager: ExtensionStateManager | null = null;
let agentHostManager: AgentHostManager | null = null;
let stableRunTimer: NodeJS.Timeout | null = null;
let isAppQuitting = false;

const STABLE_RUN_DELAY_MS = 120_000;

installGlobalErrorHandlers();

// Export for IPC handlers
export function getExtensionCommandService(): ExtensionCommandService | null {
  return extensionCommandService;
}

export function getExtensionRegistry(): ExtensionRegistry | null {
  return extensionRegistry;
}

export function getPermissionService(): PermissionService | null {
  return permissionService;
}

export function getExtensionViewService(): ExtensionViewService | null {
  return extensionViewService;
}

export function getExtensionToolService(): ExtensionToolService | null {
  return extensionToolService;
}

export function getAgentHostManager(): AgentHostManager | null {
  return agentHostManager;
}

const resolvePreloadPath = (): string => {
  // Try a few known locations produced by @electron-forge/plugin-vite
  const candidates = [
    // Same dir as compiled main (e.g., .vite/build/preload.js)
    path.join(__dirname, 'preload.js'),
    // Subfolder output (e.g., .vite/build/preload/index.js)
    path.join(__dirname, 'preload', 'index.js'),
    // Older patterns
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../preload.js'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // Ignore fs errors, continue to next candidate
    }
  }
  // Fallback to first candidate; Electron will surface a clear error if missing
  return candidates[0];
};

const resolveExtensionHostPath = (): string => {
  // Try a few known locations for the extension-host bundle
  const candidates = [
    // Dev mode: from apps/electron-shell/.vite/build to apps/extension-host/dist
    // __dirname = apps/electron-shell/.vite/build -> ../../../ gets to apps/
    path.join(__dirname, '../../../extension-host/dist/index.js'),
    // Production build: from packaged out/.../main to sibling extension-host
    path.join(__dirname, '../../extension-host/dist/index.js'),
    // Forge package structure
    path.join(__dirname, '../../apps/extension-host/dist/index.js'),
  ];
  
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log('[Main] Found Extension Host at:', p);
        return p;
      }
    } catch {
      // Ignore fs errors, continue to next candidate
    }
  }
  
  // Fallback to first candidate with warning
  console.warn('[Main] Extension Host not found, using fallback path:', candidates[0]);
  return candidates[0];
};

const resolveAgentHostPath = (): string => {
  const candidates = [
    // Dev mode: from apps/electron-shell/.vite/build to apps/agent-host/dist
    path.join(__dirname, '../../../agent-host/dist/index.js'),
    // Production build: from packaged out/.../main to sibling agent-host
    path.join(__dirname, '../../agent-host/dist/index.js'),
    // Forge package structure
    path.join(__dirname, '../../apps/agent-host/dist/index.js'),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log('[Main] Found Agent Host at:', p);
        return p;
      }
    } catch {
      // Ignore fs errors, continue to next candidate
    }
  }

  console.warn('[Main] Agent Host not found, using fallback path:', candidates[0]);
  return candidates[0];
};

const createWindow = (): void => {
  // Create the browser window with security defaults
  const useCustomTitleBar = process.platform !== 'darwin';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: useCustomTitleBar,
    frame: !useCustomTitleBar,
    webPreferences: {
      // P2 (Security defaults): contextIsolation ON
      contextIsolation: true,
      // P2 (Security defaults): sandbox ON
      sandbox: true,
      // P2 (Security defaults): nodeIntegration OFF
      nodeIntegration: false,
      // P1 (Process isolation): Preload script path
      preload: resolvePreloadPath(),
    },
  });

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[DEBUG] Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const prodPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('[DEBUG] Loading production file:', prodPath);
    mainWindow.loadFile(prodPath);
  }

  // Open DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);
  } else {
    mainWindow.setMenuBarVisibility(true);
  }

  const publishWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGED, {
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('maximize', publishWindowState);
  mainWindow.on('unmaximize', publishWindowState);
  mainWindow.on('enter-full-screen', publishWindowState);
  mainWindow.on('leave-full-screen', publishWindowState);

  attachWindowCrashRecovery(mainWindow, () => {
    if (!isAppQuitting) {
      createWindow();
    }
  });
};

// P1 (Process isolation): Main process handles app lifecycle
app.on('ready', () => {
  const runtimeState = runtimeStateService.getState();
  const safeModeEnabled = runtimeState.safeMode;

  // Register IPC handlers before creating window
  registerIPCHandlers();
  
  // Wire up terminal service events to send to renderer
  // P3 (Secrets): Terminal I/O forwarded via IPC, never logged
  terminalService.on('data', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, event);
    }
  });
  
  terminalService.on('exit', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, event);
    }
  });
  
  // Initialize Extension Host Manager and Registry
  // P1: Extension Host runs as separate process for isolation
  const extensionHostPath = resolveExtensionHostPath();
  const extensionsDir = path.join(app.getPath('userData'), 'extensions');
  
  // Ensure extensions directory exists
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }
  
  // Initialize Extension Registry
  // P2: Validates manifests against ExtensionManifestSchema
  // P3: No secrets stored in registry
  extensionRegistry = new ExtensionRegistry(extensionsDir);
  extensionRegistry.initialize().catch((error) => {
    console.error('[Main] Failed to initialize Extension Registry:', error);
  });
  
  // Initialize Permission Service
  // P1: Permission checks enforced in main process only
  // P2: No secrets stored in permissions.json
  permissionService = new PermissionService(extensionsDir);
  permissionService.initialize().catch((error) => {
    console.error('[Main] Failed to initialize Permission Service:', error);
  });
  
  // Initialize Extension State Manager
  // Task 9: Track and broadcast extension state changes
  extensionStateManager = new ExtensionStateManager();

  if (!safeModeEnabled) {
    extensionHostManager = new ExtensionHostManager({
      extensionHostPath,
      extensionsDir,
      stateManager: extensionStateManager,
    });

    // Initialize Extension Command Service
    extensionCommandService = new ExtensionCommandService(extensionHostManager);

    // Initialize Extension View Service
    // Task 8: View aggregation and rendering
    extensionViewService = new ExtensionViewService(extensionHostManager);

    // Initialize Extension Tool Service
    // Task 8: Tool aggregation and execution for Agent Host
    extensionToolService = new ExtensionToolService(extensionHostManager);

    const agentHostPath = resolveAgentHostPath();
    const BrokerMain = brokerMainModule.BrokerMain;
    const brokerMain = new BrokerMain({
      auditLogger: {
        logAgentToolAccess: (input) => {
          auditService.logAgentToolAccess(input);
        },
      },
    });
    agentHostManager = new AgentHostManager({
      agentHostPath,
      brokerMain,
      getExtensionToolService: () => extensionToolService,
    });

    agentHostManager.start().catch((error) => {
      console.error('[Main] Failed to start Agent Host:', error);
    });

    // Start Extension Host (will be lazy-loaded when needed)
    // For now, we start it on app launch. Later tasks will implement lazy loading.
    extensionHostManager.start().catch((error) => {
      console.error('[Main] Failed to start Extension Host:', error);
    });
  } else {
    console.warn('[Main] Safe Mode enabled: extension and agent hosts are disabled.');
  }
  
  // Build application menu
  buildApplicationMenu();
  createWindow();

  if (safeModeEnabled && mainWindow && !mainWindow.isDestroyed()) {
    void dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Safe Mode enabled',
      message: 'ai-shell started in Safe Mode.',
      detail: 'Extensions and agents are disabled because a crash loop was detected.',
      buttons: ['OK'],
    });
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
  // Clean up terminal sessions before quitting
  terminalService.cleanup();
  sddWatcher.stop();
  void sddTraceService.abortActiveRun('system').catch(() => undefined);
  
  // Stop Extension Host gracefully
  if (extensionHostManager) {
    extensionHostManager.stop().catch((error) => {
      console.error('[Main] Error stopping Extension Host:', error);
    });
  }

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
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
