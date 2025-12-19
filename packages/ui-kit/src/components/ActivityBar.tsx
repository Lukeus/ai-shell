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
  svg: React.ReactNode;
}

/**
 * Activity bar icons configuration.
 * Modern SVG icons with consistent design.
 */
const ACTIVITY_ICONS: ActivityIcon[] = [
  {
    id: 'explorer',
    label: 'Explorer',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Search',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 'source-control',
    label: 'Source Control',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M6 9v12M18 9c0-3.87-3.13-7-7-7h-2" />
      </svg>
    ),
  },
  {
    id: 'run-debug',
    label: 'Run and Debug',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    id: 'extensions',
    label: 'Extensions',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

/**
 * ActivityBar component - Leftmost vertical icon bar for navigation.
 * 
 * Features:
 * - Fixed width (48px)
 * - 6 placeholder icons (Explorer, Search, Source Control, Run & Debug, Extensions, Settings)
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
  
  return (
    <div className="flex flex-col items-center w-12 h-full bg-surface-secondary border-r border-border-subtle">
      {/* Top section - main icons */}
      <div className="flex flex-col items-center py-3 gap-2">
        {topIcons.map((icon) => {
          const isActive = icon.id === activeIcon;
          
          return (
            <button
              key={icon.id}
              onClick={() => onIconClick(icon.id)}
              className={`
                relative w-11 h-11 flex items-center justify-center rounded-lg
                transition-all duration-200 ease-out group
                ${
                  isActive
                    ? 'bg-accent text-primary shadow-lg scale-105 before:absolute before:left-0 before:inset-y-2 before:w-1 before:bg-accent before:rounded-r-full'
                    : 'text-secondary hover:bg-surface-hover hover:text-primary hover:scale-105 active:scale-95'
                }
              `}
              title={icon.label}
              aria-label={icon.label}
              aria-pressed={isActive}
              style={{
                boxShadow: isActive ? '0 4px 12px var(--color-glow-accent)' : 'none',
              }}
            >
              <div className="transform transition-transform duration-200 group-hover:scale-110">
                {icon.svg}
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Spacer to push bottom icons down */}
      <div className="flex-1" />
      
      {/* Bottom section - settings and other bottom icons */}
      <div className="flex flex-col items-center pb-3 gap-2 border-t border-border-subtle pt-3">
        {bottomIcons.map((icon) => {
          const isActive = icon.id === activeIcon;
          
          return (
            <button
              key={icon.id}
              onClick={() => onIconClick(icon.id)}
              className={`
                relative w-11 h-11 flex items-center justify-center rounded-lg
                transition-all duration-200 ease-out group
                ${
                  isActive
                    ? 'bg-accent text-primary shadow-lg scale-105 before:absolute before:left-0 before:inset-y-2 before:w-1 before:bg-accent before:rounded-r-full'
                    : 'text-secondary hover:bg-surface-hover hover:text-primary hover:scale-105 active:scale-95'
                }
              `}
              title={icon.label}
              aria-label={icon.label}
              aria-pressed={isActive}
              style={{
                boxShadow: isActive ? '0 4px 12px var(--color-glow-accent)' : 'none',
              }}
            >
              <div className="transform transition-transform duration-200 group-hover:scale-110">
                {icon.svg}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
