import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type MenuAction = () => void | Promise<void>;

interface MenuItem {
  id: string;
  label: string;
  action?: MenuAction;
  enabled?: boolean;
  shortcut?: string;
}

interface MenuDefinition {
  id: string;
  label: string;
  items: MenuItem[];
}

export interface MenuBarProps {
  hasWorkspace: boolean;
  onOpenFolder: MenuAction;
  onCloseFolder: MenuAction;
  onRefreshExplorer: MenuAction;
  onTogglePrimarySidebar: () => void;
  onToggleSecondarySidebar: () => void;
  onToggleBottomPanel: () => void;
}

const EMPTY_MENU_ITEM: MenuItem = {
  id: 'empty',
  label: 'No actions yet',
  enabled: false,
};

function getPlatformIsMac() {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const platform = (navigator.platform || navigator.userAgent || '').toLowerCase();
  return platform.includes('mac');
}

/**
 * MenuBar component - VS Code-style top menu bar for core actions.
 *
 * P1 (Process isolation): Uses renderer callbacks (window.api via caller), no Node.js access.
 * P4 (UI design system): Styled with Tailwind tokens + VS Code CSS variables.
 */
export function MenuBar({
  hasWorkspace,
  onOpenFolder,
  onCloseFolder,
  onRefreshExplorer,
  onTogglePrimarySidebar,
  onToggleSecondarySidebar,
  onToggleBottomPanel,
}: MenuBarProps) {
  const isMac = useMemo(() => getPlatformIsMac(), []);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMenubarActive, setIsMenubarActive] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [focusedMenuIndex, setFocusedMenuIndex] = useState(0);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const [hoveredMenuIndex, setHoveredMenuIndex] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const altKeyDown = useRef(false);
  const altUsed = useRef(false);

  const menus = useMemo<MenuDefinition[]>(() => [
    {
      id: 'file',
      label: 'File',
      items: [
        {
          id: 'open-folder',
          label: 'Open Folder...',
          shortcut: isMac ? 'Cmd+K Cmd+O' : 'Ctrl+K Ctrl+O',
          action: onOpenFolder,
        },
        {
          id: 'close-folder',
          label: 'Close Folder',
          enabled: hasWorkspace,
          action: onCloseFolder,
        },
        {
          id: 'refresh-explorer',
          label: 'Refresh Explorer',
          enabled: hasWorkspace,
          shortcut: 'F5',
          action: onRefreshExplorer,
        },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [],
    },
    {
      id: 'selection',
      label: 'Selection',
      items: [],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          id: 'toggle-primary-sidebar',
          label: 'Toggle Primary Side Bar',
          shortcut: isMac ? 'Cmd+B' : 'Ctrl+B',
          action: onTogglePrimarySidebar,
        },
        {
          id: 'toggle-secondary-sidebar',
          label: 'Toggle Secondary Side Bar',
          shortcut: isMac ? 'Cmd+Alt+B' : 'Ctrl+Alt+B',
          action: onToggleSecondarySidebar,
        },
        {
          id: 'toggle-panel',
          label: 'Toggle Panel',
          shortcut: isMac ? 'Cmd+J' : 'Ctrl+J',
          action: onToggleBottomPanel,
        },
      ],
    },
    {
      id: 'go',
      label: 'Go',
      items: [],
    },
    {
      id: 'run',
      label: 'Run',
      items: [],
    },
    {
      id: 'terminal',
      label: 'Terminal',
      items: [],
    },
    {
      id: 'help',
      label: 'Help',
      items: [],
    },
  ], [
    hasWorkspace,
    isMac,
    onCloseFolder,
    onOpenFolder,
    onRefreshExplorer,
    onToggleBottomPanel,
    onTogglePrimarySidebar,
    onToggleSecondarySidebar,
  ]);

  const normalizeMenuItems = useCallback((items: MenuItem[]) => {
    if (items.length === 0) {
      return [EMPTY_MENU_ITEM];
    }
    return items.map((item) => ({
      ...item,
      enabled: item.enabled ?? Boolean(item.action),
    }));
  }, []);

  const getMenuItemsByIndex = useCallback((index: number) => {
    const menu = menus[index];
    return normalizeMenuItems(menu ? menu.items : []);
  }, [menus, normalizeMenuItems]);

  const captureLastFocus = useCallback(() => {
    if (isMenubarActive) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      lastFocusedElement.current = activeElement;
    }
  }, [isMenubarActive]);

  const focusMenuButton = useCallback((index: number) => {
    requestAnimationFrame(() => {
      menuButtonRefs.current[index]?.focus();
    });
  }, []);

  const openMenuAt = useCallback((index: number, itemIndex = 0) => {
    const menu = menus[index];
    if (!menu) return;
    setIsMenubarActive(true);
    setFocusedMenuIndex(index);
    setOpenMenuId(menu.id);
    setFocusedItemIndex(itemIndex);
  }, [menus]);

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setFocusedItemIndex(0);
  }, []);

  const dismissMenubar = useCallback((restoreFocus: boolean) => {
    setOpenMenuId(null);
    setIsMenubarActive(false);
    setFocusedItemIndex(0);
    if (restoreFocus && lastFocusedElement.current) {
      lastFocusedElement.current.focus();
    }
  }, []);

  const activateMenuItem = useCallback((item: MenuItem) => {
    if (item.enabled === false || !item.action) return;
    dismissMenubar(true);
    void item.action();
  }, [dismissMenubar]);

  useEffect(() => {
    if (!isMenubarActive) return;
    focusMenuButton(focusedMenuIndex);
  }, [isMenubarActive, focusedMenuIndex, focusMenuButton]);

  useEffect(() => {
    menuItemRefs.current = [];
  }, [openMenuId]);

  useEffect(() => {
    if (!openMenuId) return;
    const handle = requestAnimationFrame(() => {
      menuItemRefs.current[focusedItemIndex]?.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [openMenuId, focusedItemIndex]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!menuBarRef.current) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !menuBarRef.current.contains(target)) {
        dismissMenubar(false);
      }
    };

    if (isMenubarActive || openMenuId) {
      document.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [dismissMenubar, isMenubarActive, openMenuId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altKeyDown.current = true;
        altUsed.current = false;
        return;
      }

      if (altKeyDown.current) {
        altUsed.current = true;
      }

      if (!isMenubarActive && !openMenuId) return;

      switch (event.key) {
        case 'ArrowLeft': {
          event.preventDefault();
          const nextIndex = (focusedMenuIndex - 1 + menus.length) % menus.length;
          setFocusedMenuIndex(nextIndex);
          if (openMenuId) {
            openMenuAt(nextIndex, 0);
          } else {
            focusMenuButton(nextIndex);
          }
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          const nextIndex = (focusedMenuIndex + 1) % menus.length;
          setFocusedMenuIndex(nextIndex);
          if (openMenuId) {
            openMenuAt(nextIndex, 0);
          } else {
            focusMenuButton(nextIndex);
          }
          break;
        }
        case 'ArrowDown': {
          event.preventDefault();
          if (!openMenuId) {
            openMenuAt(focusedMenuIndex, 0);
            return;
          }
          const items = getMenuItemsByIndex(focusedMenuIndex);
          const nextIndex = (focusedItemIndex + 1) % items.length;
          setFocusedItemIndex(nextIndex);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const items = getMenuItemsByIndex(focusedMenuIndex);
          if (!openMenuId) {
            openMenuAt(focusedMenuIndex, items.length - 1);
            return;
          }
          const nextIndex = (focusedItemIndex - 1 + items.length) % items.length;
          setFocusedItemIndex(nextIndex);
          break;
        }
        case 'Enter':
        case ' ': {
          event.preventDefault();
          if (!openMenuId) {
            openMenuAt(focusedMenuIndex, 0);
            return;
          }
          const items = getMenuItemsByIndex(focusedMenuIndex);
          const item = items[focusedItemIndex];
          if (item) {
            activateMenuItem(item);
          }
          break;
        }
        case 'Escape': {
          event.preventDefault();
          if (openMenuId) {
            closeMenu();
            focusMenuButton(focusedMenuIndex);
          } else if (isMenubarActive) {
            dismissMenubar(true);
          }
          break;
        }
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return;
      const shouldToggle = !altUsed.current;
      altKeyDown.current = false;
      altUsed.current = false;
      if (!shouldToggle) return;

      event.preventDefault();
      if (isMenubarActive || openMenuId) {
        dismissMenubar(true);
      } else {
        captureLastFocus();
        setIsMenubarActive(true);
        setFocusedMenuIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    activateMenuItem,
    captureLastFocus,
    closeMenu,
    dismissMenubar,
    focusMenuButton,
    focusedItemIndex,
    focusedMenuIndex,
    getMenuItemsByIndex,
    isMenubarActive,
    menus,
    openMenuAt,
    openMenuId,
  ]);

  useEffect(() => {
    if (isMac || !window.api?.windowControls) {
      return undefined;
    }

    let isMounted = true;

    const loadState = async () => {
      try {
        const state = await window.api.windowControls.getState();
        if (isMounted) {
          setIsMaximized(state.isMaximized);
        }
      } catch {
        // Ignore window state errors
      }
    };

    const unsubscribe = window.api.windowControls.onStateChange((state) => {
      setIsMaximized(state.isMaximized);
    });

    void loadState();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isMac]);

  return (
    <div
      ref={menuBarRef}
      role="menubar"
      aria-label="Application menu bar"
      className="menubar flex items-center border-b border-border-subtle bg-[var(--vscode-titleBar-activeBackground)]"
      style={{
        height: 'var(--vscode-menuBar-height, var(--vscode-titleBar-height))',
        padding: `0 var(--vscode-space-1)`,
        fontSize: 'var(--vscode-font-size-ui)',
        WebkitAppRegion: isMac ? 'no-drag' : 'drag',
      }}
    >
      <div className="flex items-center flex-1 min-w-0">
        <div
          className="flex items-center justify-center"
          style={{
            width: '16px',
            height: '16px',
            marginRight: 'var(--vscode-space-2)',
            color: 'var(--vscode-titleBar-activeForeground)',
            WebkitAppRegion: 'no-drag',
          }}
          aria-label="App icon"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6" />
            <circle cx="12.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="7" cy="13" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {menus.map((menu, index) => {
          const isOpen = openMenuId === menu.id;
          const isFocused = isMenubarActive && focusedMenuIndex === index;
          const isHovered = hoveredMenuIndex === index;
          const items = normalizeMenuItems(menu.items);
          const isSelected = isOpen || isFocused || (isHovered && !openMenuId);
          const titleColor = isSelected
            ? 'var(--vscode-menubar-selectionForeground)'
            : 'var(--vscode-titleBar-activeForeground)';
          const titleBackground = isSelected
            ? 'var(--vscode-menubar-selectionBackground)'
            : 'transparent';
          const titleOutlineStyle = isOpen || isFocused ? 'solid' : isHovered ? 'dashed' : 'none';

          return (
            <div key={menu.id} className="relative">
              <button
                ref={(element) => {
                  menuButtonRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={isOpen}
                tabIndex={isFocused ? 0 : -1}
                onMouseDown={captureLastFocus}
                onFocus={() => setIsMenubarActive(true)}
                onMouseEnter={() => {
                  setHoveredMenuIndex(index);
                  if (openMenuId) {
                    openMenuAt(index, 0);
                  }
                }}
                onMouseLeave={() => {
                  setHoveredMenuIndex(null);
                }}
                onClick={() => {
                  if (isOpen) {
                    dismissMenubar(true);
                    return;
                  }
                  captureLastFocus();
                  openMenuAt(index, 0);
                }}
                className="menubar-menu-button flex items-center cursor-default select-none whitespace-nowrap"
                style={{
                  height: '100%',
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  background: 'transparent',
                  WebkitAppRegion: 'no-drag',
                }}
              >
                <span
                  className="menubar-menu-title"
                  style={{
                    borderRadius: '4px',
                    color: titleColor,
                    backgroundColor: titleBackground,
                    outlineStyle: titleOutlineStyle,
                    outlineWidth: titleOutlineStyle === 'none' ? '0' : '1px',
                    outlineColor: 'var(--vscode-menubar-selectionBorder)',
                    outlineOffset: '-1px',
                    padding: `0 var(--vscode-space-2)`,
                    WebkitAppRegion: 'no-drag',
                  }}
                >
                  {menu.label}
                </span>
              </button>

              {isOpen && (
                <div
                  role="menu"
                  aria-label={`${menu.label} menu`}
                  className="absolute left-0 top-full mt-[1px] min-w-[180px] border border-border-subtle bg-surface-elevated py-1"
                  style={{
                    zIndex: 'var(--vscode-z-dropdown)',
                    boxShadow: '0 2px 8px var(--color-shadow-medium)',
                    WebkitAppRegion: 'no-drag',
                  }}
                >
                  {items.map((item, itemIndex) => {
                    const isDisabled = item.enabled === false;
                    const isActive = itemIndex === focusedItemIndex;

                    return (
                      <button
                        key={item.id}
                        ref={(element) => {
                          menuItemRefs.current[itemIndex] = element;
                        }}
                        type="button"
                        role="menuitem"
                        tabIndex={isActive ? 0 : -1}
                        aria-disabled={isDisabled}
                        onMouseMove={() => setFocusedItemIndex(itemIndex)}
                        onClick={() => {
                          if (isDisabled) return;
                          activateMenuItem(item);
                        }}
                        className={`
                          flex w-full items-center justify-between gap-4 text-left
                          ${isDisabled ? 'cursor-not-allowed text-tertiary' : 'text-secondary'}
                          ${isActive && !isDisabled ? 'bg-surface-hover text-primary' : ''}
                        `}
                        style={{
                          height: 'var(--vscode-list-rowHeight)',
                          paddingLeft: 'var(--vscode-space-3)',
                          paddingRight: 'var(--vscode-space-3)',
                          fontSize: 'var(--vscode-font-size-ui)',
                          WebkitAppRegion: 'no-drag',
                        }}
                      >
                        <span className="truncate">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-[11px] text-tertiary">{item.shortcut}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isMac && (
        <div
          className="flex items-center"
          style={{ WebkitAppRegion: 'no-drag', marginLeft: 'auto' }}
        >
          <button
            type="button"
            aria-label="Minimize window"
            onClick={() => window.api?.windowControls?.minimize()}
            className="flex items-center justify-center hover:bg-[var(--vscode-menubar-selectionBackground)]"
            style={{
              width: 'calc(var(--vscode-space-6) + var(--vscode-space-2))',
              height: 'var(--vscode-menuBar-height)',
              color: 'var(--vscode-titleBar-activeForeground)',
            }}
          >
            <span className="sr-only">Minimize</span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 8h8" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
            onClick={() => window.api?.windowControls?.toggleMaximize()}
            className="flex items-center justify-center hover:bg-[var(--vscode-menubar-selectionBackground)]"
            style={{
              width: 'calc(var(--vscode-space-6) + var(--vscode-space-2))',
              height: 'var(--vscode-menuBar-height)',
              color: 'var(--vscode-titleBar-activeForeground)',
            }}
          >
            <span className="sr-only">{isMaximized ? 'Restore' : 'Maximize'}</span>
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="2" y="2" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="1" y="1" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Close window"
            onClick={() => window.api?.windowControls?.close()}
            className="flex items-center justify-center hover:bg-[var(--color-status-error)]"
            style={{
              width: 'calc(var(--vscode-space-6) + var(--vscode-space-2))',
              height: 'var(--vscode-menuBar-height)',
              color: 'var(--vscode-titleBar-activeForeground)',
            }}
          >
            <span className="sr-only">Close</span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
