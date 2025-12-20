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
            h-full inline-flex items-center gap-1.5 px-2.5
            text-xs ${item.active ? 'text-primary' : 'text-secondary'}
            hover:bg-surface-hover hover:text-primary
            focus:outline-none focus:ring-1 focus:ring-accent
          `}
          style={{
            borderLeft: index === 0 ? 'none' : '1px solid var(--color-border-subtle)',
          }}
        >
          {renderIcon(item.icon)}
          <span className="whitespace-nowrap">{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="flex items-center justify-between border-t border-border-subtle"
      style={{
        height: 'var(--vscode-statusBar-height)',
        backgroundColor: 'var(--vscode-statusBar-background)',
      }}
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
