import React from 'react';

export interface StatusBarItem {
  /** Unique identifier */
  id: string;

  /** Textual label */
  label: React.ReactNode;

  /** Optional icon (codicon class or React node) */
  icon?: string | React.ReactNode;

  /** Whether the item is emphasized/active */
  active?: boolean;

  /** Tooltip text */
  tooltip?: string;

  /** Click handler */
  onClick?: () => void;
}

/**
 * Props for the StatusBar component.
 */
export interface StatusBarProps {
  /** Left-aligned items */
  leftItems?: StatusBarItem[];

  /** Right-aligned items */
  rightItems?: StatusBarItem[];
}

function renderIcon(icon?: string | React.ReactNode) {
  if (!icon) return null;
  if (typeof icon === 'string') {
    return <span className={`codicon ${icon}`} aria-hidden="true" />;
  }
  return icon;
}

/**
 * StatusBar component - VS Code style segmented bar.
 */
export function StatusBar({ leftItems = [], rightItems = [] }: StatusBarProps) {
  const renderItems = (items: StatusBarItem[]) => (
    <div className="flex items-center h-full">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          title={item.tooltip}
          className={`
            h-full inline-flex items-center gap-1
            px-1
            text-[var(--vscode-font-size-small)]
            ${item.active
              ? 'text-status-bar-foreground font-semibold'
              : 'text-[color-mix(in srgb,var(--color-status-bar-foreground)_90%,var(--color-status-bar))]'
            }
            ${index === 0
              ? 'border-l-0'
              : 'border-l border-l-[color-mix(in srgb,var(--color-status-bar-foreground)_20%,transparent)]'
            }
            hover:bg-status-bar-hover hover:text-status-bar-foreground hover:opacity-100
            focus:outline-none focus:ring-1 focus:ring-accent
          `}
        >
          {renderIcon(item.icon)}
          <span className="whitespace-nowrap">{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="
        flex items-center justify-between border-t border-border
        h-full
        bg-status-bar
        text-status-bar-foreground
      "
    >
      <div className="flex items-center h-full">
        {renderItems(leftItems)}
      </div>
      <div className="flex items-center h-full">
        {renderItems(rightItems)}
      </div>
    </div>
  );
}
