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
  const [isMenubarActive, setIsMenubarActive] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [focusedMenuIndex, setFocusedMenuIndex] = useState(0);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
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

  return (
    <div
      ref={menuBarRef}
      role="menubar"
      aria-label="Application menu bar"
      className="flex items-center gap-2 border-b border-border bg-[var(--vscode-titleBar-activeBackground)] px-2 text-[13px] text-secondary"
      style={{
        height: 'var(--vscode-menuBar-height, var(--vscode-titleBar-height))',
      }}
    >
      {menus.map((menu, index) => {
        const isOpen = openMenuId === menu.id;
        const isFocused = isMenubarActive && focusedMenuIndex === index;
        const items = normalizeMenuItems(menu.items);

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
                if (openMenuId) {
                  openMenuAt(index, 0);
                }
              }}
              onClick={() => {
                if (isOpen) {
                  dismissMenubar(true);
                  return;
                }
                captureLastFocus();
                openMenuAt(index, 0);
              }}
              className={`
                flex items-center my-3 px-3 py-3 rounded-none transition-colors
                ${isOpen || isFocused
                  ? 'bg-surface-hover text-primary'
                  : 'hover:bg-surface-hover hover:text-primary'}
              `}
            >
              {menu.label}
            </button>

            {isOpen && (
              <div
                role="menu"
                aria-label={`${menu.label} menu`}
                className="absolute left-0 top-full mt-[1px] min-w-[180px] border border-border bg-surface-secondary  py-2"
                style={{ zIndex: 'var(--vscode-z-dropdown)' }}
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
                        flex w-full items-center justify-between gap-4 px-3 text-left text-sm
                        ${isDisabled ? 'cursor-not-allowed text-tertiary' : 'text-secondary'}
                        ${isActive && !isDisabled ? 'bg-surface-hover text-primary' : ''}
                      `}
                      style={{
                        height: 'var(--vscode-list-rowHeight)',
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
  );
}
