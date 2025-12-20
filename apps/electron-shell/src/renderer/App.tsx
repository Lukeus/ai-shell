import { useEffect } from 'react';
import { ShellLayout, ResizablePanel, ActivityBar, StatusBar, PanelHeader } from 'packages-ui-kit';
import { IPC_CHANNELS } from 'packages-api-contracts';
import { LayoutProvider, useLayoutContext } from './contexts/LayoutContext';
import { ThemeProvider } from './components/ThemeProvider';
import { FileTreeContextProvider, useFileTree } from './components/explorer/FileTreeContext';
import { ExplorerPanel } from './components/layout/ExplorerPanel';
import { EditorArea } from './components/editor/EditorArea';
import { TerminalPanel } from './components/layout/TerminalPanel';
import { SecondarySidebar } from './components/layout/SecondarySidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { TerminalContextProvider } from './contexts/TerminalContext';

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
    <div className="h-screen overflow-hidden bg-surface text-primary">
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
        editorArea={isSettingsView ? <SettingsPanel /> : <EditorArea />}
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
  );
}
