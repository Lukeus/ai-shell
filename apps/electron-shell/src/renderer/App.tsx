import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TerminalContextProvider, useTerminal } from './contexts/TerminalContext';
import { CommandPalette, type BuiltInCommand } from './components/command-palette/CommandPalette';

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

  const {
    workspace,
    openWorkspace,
    closeWorkspace,
    refresh,
    openTabs,
    activeTabIndex,
    dirtyTabs,
    saveFile,
    saveAllFiles,
  } = useFileTree();
  const {
    activeSessionId,
    createSession,
    closeSession,
    clearOutput,
  } = useTerminal();
  const isSettingsView = state.activeActivityBarIcon === 'settings';
  const primarySidebarTitleMap: Record<string, string> = {
    explorer: 'Explorer',
    search: 'Search',
    'source-control': 'Source Control',
    'run-debug': 'Run and Debug',
    extensions: 'Extensions',
    settings: 'Settings',
  };
  const primarySidebarTitle = isSettingsView
    ? 'Explorer'
    : primarySidebarTitleMap[state.activeActivityBarIcon] ?? 'Explorer';
  const primarySidebarView = isSettingsView ? 'explorer' : state.activeActivityBarIcon;
  const [menuBarVisible, setMenuBarVisible] = useState(SETTINGS_DEFAULTS.appearance.menuBarVisible);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [branchName, setBranchName] = useState<string | null>(null);
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

  useEffect(() => {
    let isActive = true;

    const handleScmUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as { branch?: string | null } | undefined;
      if (!isActive) return;
      setBranchName(detail?.branch ?? null);
    };

    const refreshBranch = async () => {
      if (!workspace) {
        setBranchName(null);
        return;
      }
      try {
        const response = await window.api.scm.status({});
        if (isActive) {
          setBranchName(response.branch ?? null);
        }
      } catch (error) {
        console.error('Failed to load SCM status:', error);
      }
    };

    window.addEventListener('ai-shell:scm-status', handleScmUpdate);
    void refreshBranch();

    return () => {
      isActive = false;
      window.removeEventListener('ai-shell:scm-status', handleScmUpdate);
    };
  }, [workspace]);
  
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
    const unsubscribeHandlers: Array<() => void> = [];
    const addListener = (channel: string, handler: (...args: unknown[]) => void) => {
      const unsubscribe = window.electron?.ipcRenderer?.on?.(channel, handler);
      if (typeof unsubscribe === 'function') {
        unsubscribeHandlers.push(unsubscribe);
      } else {
        unsubscribeHandlers.push(() => {
          window.electron?.ipcRenderer?.removeListener?.(channel, handler);
        });
      }
    };

    addListener(IPC_CHANNELS.MENU_WORKSPACE_OPEN, handleMenuWorkspaceOpen);
    addListener(IPC_CHANNELS.MENU_WORKSPACE_CLOSE, handleMenuWorkspaceClose);
    addListener(IPC_CHANNELS.MENU_REFRESH_EXPLORER, handleMenuRefreshExplorer);
    addListener(
      IPC_CHANNELS.MENU_TOGGLE_SECONDARY_SIDEBAR,
      handleMenuToggleSecondarySidebar
    );
    
    // Cleanup listeners on unmount
    return () => {
      unsubscribeHandlers.forEach((unsubscribe) => unsubscribe());
    };
  }, [openWorkspace, closeWorkspace, refresh, toggleSecondarySidebar]);

  const activeFilePath =
    activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null;
  const canSaveFile = Boolean(activeFilePath && dirtyTabs.has(activeFilePath));
  const canSaveAllFiles = dirtyTabs.size > 0;

  const handleSaveFile = useCallback(async () => {
    if (!activeFilePath) return;
    await saveFile(activeFilePath);
  }, [activeFilePath, saveFile]);

  const handleSaveAllFiles = useCallback(async () => {
    await saveAllFiles();
  }, [saveAllFiles]);

  const handleCreateTerminal = useCallback(async () => {
    if (!workspace) return;
    await createSession({ cwd: workspace.path, env: undefined });
  }, [createSession, workspace]);

  const handleKillTerminal = useCallback(async () => {
    if (!activeSessionId) return;
    await closeSession(activeSessionId);
  }, [activeSessionId, closeSession]);

  const handleClearTerminal = useCallback(() => {
    if (!activeSessionId) return;
    clearOutput(activeSessionId);
  }, [activeSessionId, clearOutput]);

  const builtInCommands = useMemo<BuiltInCommand[]>(() => [
    {
      id: 'file.openFolder',
      title: 'Open Folder...',
      category: 'File',
      enabled: true,
      action: openWorkspace,
    },
    {
      id: 'file.closeFolder',
      title: 'Close Folder',
      category: 'File',
      enabled: Boolean(workspace),
      action: closeWorkspace,
    },
    {
      id: 'file.refreshExplorer',
      title: 'Refresh Explorer',
      category: 'File',
      enabled: Boolean(workspace),
      action: refresh,
    },
    {
      id: 'file.save',
      title: 'Save',
      category: 'File',
      enabled: canSaveFile,
      action: handleSaveFile,
    },
    {
      id: 'file.saveAll',
      title: 'Save All',
      category: 'File',
      enabled: canSaveAllFiles,
      action: handleSaveAllFiles,
    },
    {
      id: 'terminal.new',
      title: 'New Terminal',
      category: 'Terminal',
      enabled: Boolean(workspace),
      action: handleCreateTerminal,
    },
    {
      id: 'terminal.kill',
      title: 'Kill Terminal',
      category: 'Terminal',
      enabled: Boolean(activeSessionId),
      action: handleKillTerminal,
    },
    {
      id: 'terminal.clear',
      title: 'Clear Terminal',
      category: 'Terminal',
      enabled: Boolean(activeSessionId),
      action: handleClearTerminal,
    },
  ], [
    activeSessionId,
    canSaveAllFiles,
    canSaveFile,
    closeWorkspace,
    handleClearTerminal,
    handleCreateTerminal,
    handleKillTerminal,
    handleSaveAllFiles,
    handleSaveFile,
    openWorkspace,
    refresh,
    workspace,
  ]);

  useEffect(() => {
    let chordTimeout: ReturnType<typeof setTimeout> | null = null;
    const saveAllChordArmed = { current: false };

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMacPlatform = typeof navigator !== 'undefined'
        ? (navigator.platform || navigator.userAgent || '').toLowerCase().includes('mac')
        : false;
      const modifierPressed = isMacPlatform ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifierPressed && key === 'k') {
        event.preventDefault();
        saveAllChordArmed.current = true;
        if (chordTimeout) {
          clearTimeout(chordTimeout);
        }
        chordTimeout = setTimeout(() => {
          saveAllChordArmed.current = false;
        }, 1200);
        return;
      }

      if (saveAllChordArmed.current && key === 's') {
        event.preventDefault();
        saveAllChordArmed.current = false;
        if (chordTimeout) {
          clearTimeout(chordTimeout);
          chordTimeout = null;
        }
        void handleSaveAllFiles();
        return;
      }

      if (!modifierPressed || key !== 's') return;
      event.preventDefault();
      void handleSaveFile();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (chordTimeout) {
        clearTimeout(chordTimeout);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSaveAllFiles, handleSaveFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMacPlatform = typeof navigator !== 'undefined'
        ? (navigator.platform || navigator.userAgent || '').toLowerCase().includes('mac')
        : false;
      const modifierPressed = isMacPlatform ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if ((modifierPressed && event.shiftKey && key === 'p') || event.key === 'F1') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface text-primary">
      {!isMac && menuBarVisible && (
        <MenuBar
          hasWorkspace={Boolean(workspace)}
          onOpenFolder={openWorkspace}
          onCloseFolder={closeWorkspace}
          onRefreshExplorer={refresh}
          onSaveFile={handleSaveFile}
          onSaveAllFiles={handleSaveAllFiles}
          canSaveFile={canSaveFile}
          canSaveAllFiles={canSaveAllFiles}
          onCreateTerminal={handleCreateTerminal}
          onKillTerminal={handleKillTerminal}
          onClearTerminal={handleClearTerminal}
          canCreateTerminal={Boolean(workspace)}
          canManageTerminal={Boolean(activeSessionId)}
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
                  title={primarySidebarTitle}
                  collapsed={state.primarySidebarCollapsed}
                  onToggleCollapse={togglePrimarySidebar}
                />
                <ExplorerPanel activeView={primarySidebarView} />
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
                  label: branchName ?? 'No Repo',
                  tooltip: branchName ? `Git branch: ${branchName}` : 'No Git repository',
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
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        builtInCommands={builtInCommands}
      />
    </div>
  );
}
