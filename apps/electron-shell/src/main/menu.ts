import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from 'packages-api-contracts';

/**
 * Application menu template with workspace operations.
 * 
 * P1 (Process isolation): Menu handlers trigger IPC calls to renderer via webContents.send
 * 
 * Menu structure:
 * - File: Open Folder, Close Folder, Refresh Explorer, Quit
 * - Edit: Standard edit operations
 * - View: DevTools toggle
 * - Help: About
 */

/**
 * Build and set the application menu.
 * 
 * @param hasWorkspace - Whether a workspace is currently open (for conditional menu items)
 */
export function buildApplicationMenu(hasWorkspace = false): void {
  const isMac = process.platform === 'darwin';
  
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: isMac ? 'Cmd+K Cmd+O' : 'Ctrl+K Ctrl+O',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              // P1: Trigger workspace open via IPC to renderer
              focusedWindow.webContents.send(IPC_CHANNELS.MENU_WORKSPACE_OPEN);
            }
          },
        },
        {
          label: 'Close Folder',
          visible: hasWorkspace,
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              // P1: Trigger workspace close via IPC to renderer
              focusedWindow.webContents.send(IPC_CHANNELS.MENU_WORKSPACE_CLOSE);
            }
          },
        },
        {
          label: 'Refresh Explorer',
          accelerator: 'F5',
          visible: hasWorkspace,
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              // P1: Trigger explorer refresh via IPC to renderer
              focusedWindow.webContents.send(IPC_CHANNELS.MENU_REFRESH_EXPLORER);
            }
          },
        },
        { type: 'separator' as const },
        ...(isMac ? [] : [{ role: 'quit' as const }]),
      ],
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const },
            ],
          },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const },
        ]),
      ],
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        {
          label: 'Toggle Secondary Side Bar',
          accelerator: isMac ? 'Cmd+Alt+B' : 'Ctrl+Alt+B',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send(IPC_CHANNELS.MENU_TOGGLE_SECONDARY_SIDEBAR);
            }
          },
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    
    // Window menu (macOS)
    ...(isMac ? [{
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        { type: 'separator' as const },
        { role: 'front' as const },
        { type: 'separator' as const },
        { role: 'window' as const },
      ],
    }] : []),
    
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/electron/electron');
          },
        },
      ],
    },
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Update menu dynamically based on workspace state.
 * Call this whenever workspace opens/closes.
 * 
 * @param hasWorkspace - Whether a workspace is currently open
 */
export function updateMenuForWorkspace(hasWorkspace: boolean): void {
  buildApplicationMenu(hasWorkspace);
}
