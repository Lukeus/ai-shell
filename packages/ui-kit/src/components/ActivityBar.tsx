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
  icon: string;
}

/**
 * Activity bar icons configuration.
 * These are placeholders - real implementations will register via extension API.
 */
const ACTIVITY_ICONS: ActivityIcon[] = [
  { id: 'explorer', label: 'Explorer', icon: '📁' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'source-control', label: 'Source Control', icon: '🔀' },
  { id: 'run-debug', label: 'Run and Debug', icon: '▶️' },
  { id: 'extensions', label: 'Extensions', icon: '🧩' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
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
  return (
    <div className="flex flex-col items-center w-12 h-full py-2 gap-1">
      {ACTIVITY_ICONS.map((icon) => {
        const isActive = icon.id === activeIcon;
        
        return (
          <button
            key={icon.id}
            onClick={() => onIconClick(icon.id)}
            className={`
              w-10 h-10 flex items-center justify-center rounded
              transition-colors duration-150
              ${isActive ? 'bg-accent text-primary' : 'text-secondary hover:bg-surface-secondary hover:text-primary'}
            `}
            title={icon.label}
            aria-label={icon.label}
            aria-pressed={isActive}
          >
            <span className="text-xl" role="img" aria-label={icon.label}>
              {icon.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}
