import React, { type ReactNode } from 'react';
import {
  Menu as HeadlessMenu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSeparator,
} from '@headlessui/react';

export type MenuEntry =
  | {
      id?: string;
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      icon?: ReactNode;
      shortcut?: string;
      type?: 'item';
    }
  | {
      id?: string;
      type: 'separator';
    };

export interface MenuProps {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  trigger?: ReactNode;
  items: MenuEntry[];
  align?: 'start' | 'end';
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export function Menu({
  triggerLabel,
  triggerIcon,
  trigger,
  items,
  align = 'start',
  className = '',
  buttonClassName = '',
  menuClassName = '',
}: MenuProps) {
  const alignmentClass = align === 'end' ? 'right-0' : 'left-0';

  return (
    <HeadlessMenu as="div" className={`relative inline-block text-left ${className}`}>
      <MenuButton
        type="button"
        className={`
          inline-flex items-center gap-2 rounded-sm px-2 py-1 text-sm text-secondary
          hover:bg-surface-hover hover:text-primary
          focus:outline-none focus:ring-1 focus:ring-accent
          ${buttonClassName}
        `}
        aria-label={triggerLabel}
      >
        {trigger ?? (
          <>
            {triggerIcon && <span className="text-secondary">{triggerIcon}</span>}
            <span>{triggerLabel}</span>
          </>
        )}
      </MenuButton>
      <MenuItems
        className={`
          absolute ${alignmentClass} mt-1 min-w-[180px] rounded-sm border
          border-border bg-surface-elevated text-primary shadow-lg focus:outline-none
          ${menuClassName}
        `}
        style={{
          zIndex: 'var(--vscode-z-dropdown)',
          boxShadow: '0 6px 24px var(--color-shadow-medium)',
        }}
      >
        <div className="py-1">
          {items.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <MenuSeparator
                  key={item.id ?? `separator-${index}`}
                  className="my-1 h-px bg-border-subtle"
                />
              );
            }

            return (
              <MenuItem
                key={item.id ?? item.label}
                disabled={item.disabled}
                as="button"
                type="button"
                onClick={() => item.onClick?.()}
                className={({ active, disabled }) => `
                  flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${active ? 'bg-selection text-selection-text' : 'text-primary'}
                `}
              >
                {item.icon && <span className="text-secondary">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-tertiary">{item.shortcut}</span>
                )}
              </MenuItem>
            );
          })}
        </div>
      </MenuItems>
    </HeadlessMenu>
  );
}
