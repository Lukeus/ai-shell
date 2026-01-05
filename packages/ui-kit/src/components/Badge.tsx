import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
}

const VARIANT_COLORS: Record<BadgeVariant, string | null> = {
  default: null,
  success: 'var(--color-status-success)',
  warning: 'var(--color-status-warning)',
  danger: 'var(--color-status-error)',
  info: 'var(--color-status-info)',
  muted: null,
  blue: 'var(--color-accent-primary)',
  indigo: 'var(--color-accent-secondary)',
  purple: 'var(--color-accent-gradient-to)',
  pink: 'var(--color-status-error)',
};

export function Badge({
  label,
  variant = 'default',
  onClick,
  title,
  className = '',
}: BadgeProps) {
  const color = VARIANT_COLORS[variant];
  const baseClasses = `
    inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide
  `;
  const variantClasses = variant === 'muted'
    ? 'text-tertiary border-border-subtle'
    : 'text-secondary border-border-subtle';
  const interactiveClasses = onClick
    ? 'hover:bg-surface-hover focus:outline-none focus:ring-1 focus:ring-accent'
    : '';

  const style = color ? { color, borderColor: color } : undefined;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title ?? label}
        className={`${baseClasses} ${variantClasses} ${interactiveClasses} ${className}`}
        style={style}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      title={title ?? label}
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
    >
      {label}
    </span>
  );
}
