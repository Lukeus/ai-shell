import { useEffect, useState } from 'react';
import { ShellLayout, ResizablePanel, ActivityBar, StatusBar, PanelHeader, TabBar, type Tab } from 'packages-ui-kit';
import { IPC_CHANNELS, SETTINGS_DEFAULTS, type Settings } from 'packages-api-contracts';
import { LayoutProvider, useLayoutContext } from './contexts/LayoutContext';
import { ThemeProvider } from './components/ThemeProvider';
import { FileTreeContextProvider, useFileTree } from './components/explorer/FileTreeContext';
import { ExplorerPanel } from './components/layout/ExplorerPanel';
import { MenuBar } from './components/layout/MenuBar';
import { EditorArea } from './components/editor/EditorArea';
import { TerminalPanel } from './components/layout/TerminalPanel';
import { SecondarySidebar } from './components/layout/SecondarySidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { TerminalContextProvider } from './contexts/TerminalContext';

type SettingsUpdateListener = (event: { detail?: Settings }) => void;

/**
 * Main application component for ai-shell.
 * 
 * Renders VS Code-like shell layout with 6 regions:
 * - Activity Bar (left, 48px fixed width)
 * - Primary Sidebar (left, resizable, collapsible)
 * - Editor Area (center, flexible)
 * - Secondary Sidebar (right, resizable, collapsible)
 * - Bottom Panel (bottom, resizable, collapsible)
 * - Status Bar (bottom, 24px fixed height)
 * 
 * Layout state persists to localStorage and restores on app relaunch.
 * Keyboard shortcuts: Ctrl+B (toggle primary sidebar), Ctrl+J (toggle bottom panel), Ctrl+, (open settings).
 * 
 * P1 (Process isolation): Renderer is sandboxed, no Node.js access.
 * P4 (UI design system): Uses Tailwind 4 CSS-first tokens.
 * P5 (Performance budgets): Optimized for <50ms initial render.
 */
export function App() {
  return (
    <ThemeProvider>
      <LayoutProvider>
        <FileTreeContextProvider>
          <TerminalContextProvider>
            <AppContent />
          </TerminalContextProvider>
        </FileTreeContextProvider>
      </LayoutProvider>
    </ThemeProvider>
  );
}

/**
 * Inner app content component that uses LayoutContext.
 * Separated from App to access useLayoutContext hook.
 */
function AppContent() {
  const {
    state,
    updatePrimarySidebarWidth,
    updateSecondarySidebarWidth,
    updateBottomPanelHeight,
    togglePrimarySidebar,
    toggleSecondarySidebar,
    toggleBottomPanel,
    setActiveActivityBarIcon,
  } = useLayoutContext();

  const { workspace, openWorkspace, closeWorkspace, refresh, openTabs, activeTabIndex } = useFileTree();
  const isSettingsView = state.activeActivityBarIcon === 'settings';
  const [menuBarVisible, setMenuBarVisible] = useState(SETTINGS_DEFAULTS.appearance.menuBarVisible);
  const isMac = typeof navigator !== 'undefined'
    ? (navigator.platform || navigator.userAgent || '').toLowerCase().includes('mac')
    : false;

  const settingsTabs: Tab[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <span className="codicon codicon-settings-gear" aria-hidden="true" />,
      closable: false,
    },
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadMenuBarSetting() {
      try {
        const settings = await window.api.getSettings();
        if (isMounted) {
          setMenuBarVisible(settings.appearance.menuBarVisible);
        }
      } catch (error) {
        console.error('Failed to load menu bar setting:', error);
      }
    }

    const settingsEventTarget = window as unknown as {
      addEventListener: (type: string, listener: SettingsUpdateListener) => void;
      removeEventListener: (type: string, listener: SettingsUpdateListener) => void;
    };

    const handleSettingsUpdated: SettingsUpdateListener = (event) => {
      const updated = event.detail;
      if (updated?.appearance) {
        setMenuBarVisible(updated.appearance.menuBarVisible);
      }
    };

    void loadMenuBarSetting();
    settingsEventTarget.addEventListener('ai-shell:settings-updated', handleSettingsUpdated);

    return () => {
      isMounted = false;
      settingsEventTarget.removeEventListener('ai-shell:settings-updated', handleSettingsUpdated);
    };
  }, []);
  
  // P1 (Process isolation): Listen for menu events from main process
  useEffect(() => {
    // Listen for menu-triggered workspace operations
    const handleMenuWorkspaceOpen = () => {
      openWorkspace();
    };
    
    const handleMenuWorkspaceClose = () => {
      closeWorkspace();
    };
    
    const handleMenuRefreshExplorer = () => {
      refresh();
    };

    const handleMenuToggleSecondarySidebar = () => {
      toggleSecondarySidebar();
    };
    
    // Subscribe to menu events from main process
    window.electron?.ipcRenderer?.on?.(IPC_CHANNELS.MENU_WORKSPACE_OPEN, handleMenuWorkspaceOpen);
    window.electron?.ipcRenderer?.on?.(IPC_CHANNELS.MENU_WORKSPACE_CLOSE, handleMenuWorkspaceClose);
    window.electron?.ipcRenderer?.on?.(IPC_CHANNELS.MENU_REFRESH_EXPLORER, handleMenuRefreshExplorer);
    window.electron?.ipcRenderer?.on?.(
      IPC_CHANNELS.MENU_TOGGLE_SECONDARY_SIDEBAR,
      handleMenuToggleSecondarySidebar
    );
    
    // Cleanup listeners on unmount
    return () => {
      window.electron?.ipcRenderer?.removeListener?.(
        IPC_CHANNELS.MENU_WORKSPACE_OPEN,
        handleMenuWorkspaceOpen
      );
      window.electron?.ipcRenderer?.removeListener?.(
        IPC_CHANNELS.MENU_WORKSPACE_CLOSE,
        handleMenuWorkspaceClose
      );
      window.electron?.ipcRenderer?.removeListener?.(
        IPC_CHANNELS.MENU_REFRESH_EXPLORER,
        handleMenuRefreshExplorer
      );
      window.electron?.ipcRenderer?.removeListener?.(
        IPC_CHANNELS.MENU_TOGGLE_SECONDARY_SIDEBAR,
        handleMenuToggleSecondarySidebar
      );
    };
  }, [openWorkspace, closeWorkspace, refresh, toggleSecondarySidebar]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface text-primary">
      {!isMac && menuBarVisible && (
        <MenuBar
          hasWorkspace={Boolean(workspace)}
          onOpenFolder={openWorkspace}
          onCloseFolder={closeWorkspace}
          onRefreshExplorer={refresh}
          onTogglePrimarySidebar={togglePrimarySidebar}
          onToggleSecondarySidebar={toggleSecondarySidebar}
          onToggleBottomPanel={toggleBottomPanel}
        />
      )}
      <div className="flex-1 min-h-0">
        <ShellLayout
          layoutState={state}
          onLayoutChange={() => {
            // Layout state is managed by context, no-op here
          }}
          activityBar={
            <ActivityBar
              activeIcon={state.activeActivityBarIcon}
              onIconClick={(icon: string) => setActiveActivityBarIcon(icon)}
            />
          }
          primarySidebar={
            <ResizablePanel
              direction="horizontal"
              size={state.primarySidebarWidth}
              minSize={200}
              maxSize={600}
              collapsed={state.primarySidebarCollapsed}
              defaultSize={300}
              onResize={updatePrimarySidebarWidth}
              onToggleCollapse={togglePrimarySidebar}
            >
              <div className="flex flex-col h-full">
                <PanelHeader
                  title="Explorer"
                  collapsed={state.primarySidebarCollapsed}
                  onToggleCollapse={togglePrimarySidebar}
                />
                <ExplorerPanel />
              </div>
            </ResizablePanel>
          }
          editorArea={
            isSettingsView ? (
              <div className="flex flex-col h-full bg-surface">
                <TabBar
                  tabs={settingsTabs}
                  activeTabId="settings"
                  onTabChange={() => {}}
                />
                <div className="flex-1 overflow-hidden bg-surface">
                  <SettingsPanel />
                </div>
              </div>
            ) : (
              <EditorArea />
            )
          }
          secondarySidebar={
            <SecondarySidebar
              width={state.secondarySidebarWidth}
              collapsed={state.secondarySidebarCollapsed}
              onResize={updateSecondarySidebarWidth}
              onToggleCollapse={toggleSecondarySidebar}
            />
          }
          bottomPanel={
            <ResizablePanel
              direction="vertical"
              size={state.bottomPanelHeight}
              minSize={100}
              maxSize={600}
              collapsed={state.bottomPanelCollapsed}
              defaultSize={200}
              handlePosition="start"
              onResize={updateBottomPanelHeight}
              onToggleCollapse={toggleBottomPanel}
            >
              <TerminalPanel />
            </ResizablePanel>
          }
          statusBar={
            <StatusBar
              leftItems={[
                {
                  id: 'workspace',
                  icon: workspace ? 'codicon-root-folder' : 'codicon-folder-opened',
                  label: workspace ? workspace.name : 'No Folder Open',
                  tooltip: workspace?.path,
                },
                {
                  id: 'git',
                  icon: 'codicon-source-control',
                  label: 'master',
                  tooltip: 'Git branch (placeholder)',
                },
              ]}
              rightItems={[
                {
                  id: 'position',
                  icon: 'codicon-whole-word',
                  label: 'Ln 1, Col 1',
                  tooltip: 'Cursor position',
                },
                {
                  id: 'indent',
                  icon: 'codicon-layout',
                  label: 'Spaces: 2',
                  tooltip: 'Indentation',
                },
                {
                  id: 'encoding',
                  icon: 'codicon-code',
                  label: 'UTF-8',
                  tooltip: 'File encoding',
                },
                {
                  id: 'eol',
                  icon: 'codicon-arrow-both',
                  label: 'LF',
                  tooltip: 'End of line sequence',
                },
                {
                  id: 'lang',
                  icon: 'codicon-file-code',
                  label: activeTabIndex >= 0 ? openTabs[activeTabIndex].split('.').pop()?.toUpperCase() ?? 'Text' : 'Plain Text',
                  tooltip: 'Language',
                },
                {
                  id: 'notifications',
                  icon: 'codicon-bell',
                  label: '',
                  tooltip: 'Notifications',
                },
              ]}
            />
          }
        />
      </div>
    </div>
  );
}
