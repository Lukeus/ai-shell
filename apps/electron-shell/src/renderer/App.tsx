import { useEffect } from 'react';
import { ShellLayout, ResizablePanel, ActivityBar, StatusBar, PanelHeader } from 'packages-ui-kit';
import { LayoutProvider, useLayoutContext } from './contexts/LayoutContext';
import { ThemeProvider } from './components/ThemeProvider';
import { FileTreeContextProvider, useFileTree } from './components/explorer/FileTreeContext';
import { ExplorerPanel } from './components/layout/ExplorerPanel';
import { EditorArea } from './components/editor/EditorArea';
import { TerminalPanel } from './components/layout/TerminalPanel';
import { AIAssistantPanel } from './components/layout/AIAssistantPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';

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
          <AppContent />
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
  
  const { workspace, openWorkspace, closeWorkspace, refresh } = useFileTree();
  
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
    
    // Subscribe to menu events from main process
    window.electron?.ipcRenderer?.on?.('menu:workspace-open', handleMenuWorkspaceOpen);
    window.electron?.ipcRenderer?.on?.('menu:workspace-close', handleMenuWorkspaceClose);
    window.electron?.ipcRenderer?.on?.('menu:refresh-explorer', handleMenuRefreshExplorer);
    
    // Cleanup listeners on unmount
    return () => {
      window.electron?.ipcRenderer?.removeListener?.('menu:workspace-open', handleMenuWorkspaceOpen);
      window.electron?.ipcRenderer?.removeListener?.('menu:workspace-close', handleMenuWorkspaceClose);
      window.electron?.ipcRenderer?.removeListener?.('menu:refresh-explorer', handleMenuRefreshExplorer);
    };
  }, [openWorkspace, closeWorkspace, refresh]);

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
            onResize={updatePrimarySidebarWidth}
            onToggleCollapse={togglePrimarySidebar}
          >
            <div className="flex flex-col h-full">
              <PanelHeader
                title={state.activeActivityBarIcon === 'settings' ? 'Settings' : 'Explorer'}
                collapsed={state.primarySidebarCollapsed}
                onToggleCollapse={togglePrimarySidebar}
              />
              {state.activeActivityBarIcon === 'settings' ? (
                <SettingsPanel />
              ) : (
                <ExplorerPanel />
              )}
            </div>
          </ResizablePanel>
        }
        editorArea={<EditorArea />}
        secondarySidebar={
          <ResizablePanel
            direction="horizontal"
            size={state.secondarySidebarWidth}
            minSize={200}
            maxSize={600}
            collapsed={state.secondarySidebarCollapsed}
            onResize={updateSecondarySidebarWidth}
            onToggleCollapse={toggleSecondarySidebar}
          >
            <div className="flex flex-col h-full">
              <PanelHeader
                title="AI Assistant"
                collapsed={state.secondarySidebarCollapsed}
                onToggleCollapse={toggleSecondarySidebar}
              />
              <AIAssistantPanel />
            </div>
          </ResizablePanel>
        }
        bottomPanel={
          <ResizablePanel
            direction="vertical"
            size={state.bottomPanelHeight}
            minSize={100}
            maxSize={600}
            collapsed={state.bottomPanelCollapsed}
            onResize={updateBottomPanelHeight}
            onToggleCollapse={toggleBottomPanel}
          >
            <TerminalPanel />
          </ResizablePanel>
        }
        statusBar={
          <StatusBar
            leftContent={
              <span className="text-xs">
                {workspace ? workspace.name : 'No Folder Open'}
              </span>
            }
            rightContent={
              <span className="text-xs text-gray-400">ai-shell v0.0.1</span>
            }
          />
        }
      />
    </div>
  );
}
