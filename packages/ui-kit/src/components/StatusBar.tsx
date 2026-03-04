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

const STATUS_BAR_ICON_CLASS = 'inline-flex items-center text-[11px] leading-none';
const STATUS_BAR_LABEL_CLASS = 'min-w-0 truncate whitespace-nowrap';
const STATUS_BAR_TOP_BORDER_COLOR = 'var(--color-status-bar-border)';
const STATUS_BAR_SEPARATOR_COLOR = 'var(--color-status-bar-separator)';

const isEmptyStringLabel = (label: React.ReactNode): boolean =>
  typeof label === 'string' && label.trim().length === 0;

const getStatusBarItemClassName = (item: StatusBarItem, index: number, hasLabel: boolean): string => `
  inline-flex h-full min-w-0 items-center
  ${hasLabel ? 'gap-1.5 px-[var(--vscode-space-2)]' : 'justify-center px-[var(--vscode-space-1)]'}
  text-[var(--vscode-font-size-small)] leading-none
  ${item.active
    ? 'font-semibold text-status-bar-foreground'
    : 'text-[color-mix(in_srgb,var(--color-status-bar-foreground)_90%,var(--color-status-bar))]'
  }
  ${index === 0
    ? ''
    : 'border-l'
  }
`;

function renderIcon(icon?: string | React.ReactNode) {
  if (!icon) return null;
  if (typeof icon === 'string') {
    return (
      <span
        className={`codicon ${icon} ${STATUS_BAR_ICON_CLASS}`}
        aria-hidden="true"
      />
    );
  }
  return icon;
}

/**
 * StatusBar component - VS Code style segmented bar.
 */
export function StatusBar({ leftItems = [], rightItems = [] }: StatusBarProps) {
  const renderItems = (items: StatusBarItem[]) =>
    items.map((item, index) => {
      const hasLabel = !isEmptyStringLabel(item.label);
      const isInteractive = typeof item.onClick === 'function';
      const className = getStatusBarItemClassName(item, index, hasLabel);
      const itemContent = (
        <>
          {renderIcon(item.icon)}
          {hasLabel ? <span className={STATUS_BAR_LABEL_CLASS}>{item.label}</span> : null}
        </>
      );

      if (!isInteractive) {
        return (
          <div
            key={item.id}
            title={item.tooltip}
            className={`${className} cursor-default`}
            style={index === 0 ? undefined : { borderLeftColor: STATUS_BAR_SEPARATOR_COLOR }}
          >
            {itemContent}
          </div>
        );
      }

      return (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          title={item.tooltip}
          aria-label={hasLabel ? undefined : item.tooltip ?? item.id}
          className={`
            ${className}
            cursor-pointer
            hover:bg-status-bar-hover hover:text-status-bar-foreground
            focus:outline-none
            focus-visible:outline-none
            focus-visible:ring-1
            focus-visible:ring-inset
            focus-visible:ring-[var(--color-status-bar-focus-ring)]
          `}
          style={{
            ...(index === 0 ? {} : { borderLeftColor: STATUS_BAR_SEPARATOR_COLOR }),
          }}
        >
          {itemContent}
        </button>
      );
    });

  return (
    <div
      className="flex h-[var(--size-statusBar-height)] items-stretch justify-between overflow-hidden bg-status-bar text-status-bar-foreground"
      style={{
        borderTop: `1px solid ${STATUS_BAR_TOP_BORDER_COLOR}`,
      }}
    >
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        <div className="flex h-full min-w-0 items-stretch overflow-hidden">{renderItems(leftItems)}</div>
      </div>
      <div className="flex shrink-0 items-stretch overflow-hidden">
        <div className="flex h-full items-stretch overflow-hidden">{renderItems(rightItems)}</div>
      </div>
    </div>
  );
}
