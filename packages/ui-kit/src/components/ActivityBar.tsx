import { Tab, TabGroup, TabList } from '@headlessui/react';

import { Icon, type IconProps } from './Icon';

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
  iconName: IconProps['name'];
}

/**
 * Activity bar icons configuration.
 * Modern SVG icons with consistent design.
 */
const ACTIVITY_ICONS: ActivityIcon[] = [
  {
    id: 'explorer',
    label: 'Explorer',
    iconName: 'explorer',
  },
  {
    id: 'search',
    label: 'Search',
    iconName: 'search',
  },
  {
    id: 'source-control',
    label: 'Source Control',
    iconName: 'source-control',
  },
  {
    id: 'run-debug',
    label: 'Run and Debug',
    iconName: 'run-debug',
  },
  {
    id: 'extensions',
    label: 'Extensions',
    iconName: 'extensions',
  },
  {
    id: 'sdd',
    label: 'SDD',
    iconName: 'sdd',
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'settings',
  },
];

/**
 * ActivityBar component - Leftmost vertical icon bar for navigation.
 * 
 * Features:
 * - Fixed width (48px)
 * - 7 placeholder icons (Explorer, Search, Source Control, Run & Debug, Extensions, SDD, Settings)
 * - Active icon highlighted with accent border
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
  const allIcons = [...topIcons, ...bottomIcons];
  const itemSize = 'var(--size-activityBar-width, var(--vscode-activityBar-width))';
  const iconSize = 'var(--vscode-activityBar-iconSize)';
  const selectedIndex = Math.max(0, allIcons.findIndex(icon => icon.id === activeIcon));
  
  return (
    <div
      className="flex flex-col items-center h-full overflow-hidden bg-surface-elevated border-r border-border-subtle"
      style={{
        width: itemSize,
        minWidth: itemSize,
        maxWidth: itemSize,
      }}
    >
      <TabGroup
        vertical
        selectedIndex={selectedIndex}
        onChange={(index) => {
          const icon = allIcons[index];
          if (icon) {
            onIconClick(icon.id);
          }
        }}
        className="flex flex-col h-full w-full"
      >
        <TabList className="flex flex-col items-center flex-1 w-full">
          {/* Top section - main icons */}
          <div
            className="flex flex-col items-center"
            style={{
              paddingTop: 'var(--vscode-space-1)',
              gap: 'var(--vscode-space-1)',
            }}
          >
            {topIcons.map((icon) => (
              <Tab
                key={icon.id}
                className={({ selected }) => `
                  relative flex items-center justify-center
                  transition-colors duration-150 ease-out group
                  text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                  ${selected ? 'text-primary border-l-2 border-accent' : 'hover:bg-surface-hover hover:text-primary'}
                `}
                style={{
                  width: itemSize,
                  height: itemSize,
                }}
                title={icon.label}
                aria-label={icon.label}
              >
                <Icon
                  name={icon.iconName}
                  className="transition-colors duration-150 ease-out"
                  size={iconSize}
                />
              </Tab>
            ))}
          </div>
          
          {/* Spacer to push bottom icons down */}
          <div className="flex-1" aria-hidden="true" />
          
          {/* Bottom section - settings and other bottom icons */}
          <div
            className="flex flex-col items-center border-t border-border-subtle"
            style={{
              paddingTop: 'var(--vscode-space-2)',
              paddingBottom: 'var(--vscode-space-2)',
              gap: 'var(--vscode-space-1)',
            }}
          >
            {bottomIcons.map((icon) => (
              <Tab
                key={icon.id}
                className={({ selected }) => `
                  relative flex items-center justify-center
                  transition-colors duration-150 ease-out group
                  text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                  ${selected ? 'text-primary border-l-2 border-accent' : 'hover:bg-surface-hover hover:text-primary'}
                `}
                style={{
                  width: itemSize,
                  height: itemSize,
                }}
                title={icon.label}
                aria-label={icon.label}
              >
                <Icon
                  name={icon.iconName}
                  className="transition-colors duration-150 ease-out"
                  size={iconSize}
                />
              </Tab>
            ))}
          </div>
        </TabList>
      </TabGroup>
    </div>
  );
}
