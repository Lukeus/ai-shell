/**
 * Props for the ActivityBar component.
 */
export interface ActivityBarProps {
  /** Currently active icon ID */
  activeIcon: string;
  
  /** Callback when an icon is clicked */
  onIconClick: (iconId: string) => void;
}

/**
 * Icon definition for activity bar items.
 */
interface ActivityIcon {
  id: string;
  label: string;
  codicon: string;
}

/**
 * Activity bar icons configuration.
 * Modern SVG icons with consistent design.
 */
const ACTIVITY_ICONS: ActivityIcon[] = [
  {
    id: 'explorer',
    label: 'Explorer',
    codicon: 'codicon-files',
  },
  {
    id: 'search',
    label: 'Search',
    codicon: 'codicon-search',
  },
  {
    id: 'source-control',
    label: 'Source Control',
    codicon: 'codicon-source-control',
  },
  {
    id: 'run-debug',
    label: 'Run and Debug',
    codicon: 'codicon-debug-alt',
  },
  {
    id: 'extensions',
    label: 'Extensions',
    codicon: 'codicon-extensions',
  },
  {
    id: 'sdd',
    label: 'SDD',
    codicon: 'codicon-checklist',
  },
  {
    id: 'settings',
    label: 'Settings',
    codicon: 'codicon-settings-gear',
  },
];

/**
 * ActivityBar component - Leftmost vertical icon bar for navigation.
 * 
 * Features:
 * - Fixed width (48px)
 * - 7 placeholder icons (Explorer, Search, Source Control, Run & Debug, Extensions, SDD, Settings)
 * - Active icon highlighted with bg-blue-600
 * - Click handler emits icon ID
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <ActivityBar
 *   activeIcon="explorer"
 *   onIconClick={(id) => console.log('Clicked:', id)}
 * />
 * ```
 */
export function ActivityBar({ activeIcon, onIconClick }: ActivityBarProps) {
  // Split icons into top (main) and bottom (settings)
  const topIcons = ACTIVITY_ICONS.filter(icon => icon.id !== 'settings');
  const bottomIcons = ACTIVITY_ICONS.filter(icon => icon.id === 'settings');
  const itemSize = 'var(--size-activityBar-width, var(--vscode-activityBar-width))';
  const iconSize = 'var(--vscode-activityBar-iconSize)';
  
  return (
    <div
      className="flex flex-col items-center h-full overflow-hidden bg-surface-elevated border-r border-border-subtle"
      style={{
        width: itemSize,
        minWidth: itemSize,
        maxWidth: itemSize,
      }}
    >
      {/* Top section - main icons */}
      <div
        className="flex flex-col items-center"
        style={{
          paddingTop: 'var(--vscode-space-1)',
          gap: 'var(--vscode-space-1)',
        }}
      >
        {topIcons.map((icon) => {
          const isActive = icon.id === activeIcon;
          
          return (
            <button
              key={icon.id}
              onClick={() => onIconClick(icon.id)}
              className={`
                relative flex items-center justify-center
                transition-colors duration-150 ease-out group
                text-secondary
                ${isActive ? 'text-primary border-l-2 border-accent' : 'hover:bg-surface-hover hover:text-primary'}
              `}
              style={{
                width: itemSize,
                height: itemSize,
              }}
              title={icon.label}
              aria-label={icon.label}
              aria-pressed={isActive}
            >
              <div
                className={`codicon ${icon.codicon} text-lg`}
                aria-hidden="true"
                style={{
                  fontSize: iconSize,
                }}
              />
            </button>
          );
        })}
      </div>
      
      {/* Spacer to push bottom icons down */}
      <div className="flex-1" />
      
      {/* Bottom section - settings and other bottom icons */}
      <div
        className="flex flex-col items-center border-t border-border-subtle"
        style={{
          paddingTop: 'var(--vscode-space-2)',
          paddingBottom: 'var(--vscode-space-2)',
          gap: 'var(--vscode-space-1)',
        }}
      >
        {bottomIcons.map((icon) => {
          const isActive = icon.id === activeIcon;
          
          return (
            <button
              key={icon.id}
              onClick={() => onIconClick(icon.id)}
              className={`
                relative flex items-center justify-center
                transition-colors duration-150 ease-out group
                text-secondary
                ${isActive ? 'text-primary border-l-2 border-accent' : 'hover:bg-surface-hover hover:text-primary'}
              `}
              style={{
                width: itemSize,
                height: itemSize,
              }}
              title={icon.label}
              aria-label={icon.label}
              aria-pressed={isActive}
            >
              <div
                className={`codicon ${icon.codicon} text-lg`}
                aria-hidden="true"
                style={{
                  fontSize: iconSize,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
