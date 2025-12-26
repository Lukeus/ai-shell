import React from 'react';
import { Badge, type BadgeVariant } from 'packages-ui-kit';

type SddBadgeStatus = 'tracked' | 'untracked';

interface SddBadgeProps {
  status: SddBadgeStatus;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  as?: 'button' | 'span';
}

const STATUS_CONFIG: Record<
  SddBadgeStatus,
  { label: string; variant: BadgeVariant; className: string }
> = {
  tracked: {
    label: 'Tracked',
    variant: 'muted',
    className: 'text-status-success border-border-subtle bg-surface-elevated normal-case tracking-normal text-[10px] rounded-sm px-1.5 py-0',
  },
  untracked: {
    label: 'Untracked',
    variant: 'muted',
    className: 'text-status-warning border-border-subtle bg-surface-elevated normal-case tracking-normal text-[10px] rounded-sm px-1.5 py-0',
  },
};

export function SddBadge({ status, title, onClick, as }: SddBadgeProps) {
  const { label, variant, className } = STATUS_CONFIG[status];
  const elementType = as ?? (onClick ? 'button' : 'span');
  const interactiveClassName = onClick ? 'cursor-pointer hover:bg-surface-hover' : '';
  const combinedClassName = `${className} ${interactiveClassName}`.trim();

  if (elementType === 'span') {
    return (
      <span
        role={onClick ? 'button' : undefined}
        onClick={onClick}
        className="inline-flex"
      >
        <Badge
          label={label}
          variant={variant}
          title={title}
          className={combinedClassName}
        />
      </span>
    );
  }

  return (
    <Badge
      label={label}
      variant={variant}
      title={title}
      onClick={onClick ? (event) => onClick(event) : undefined}
      className={combinedClassName}
    />
  );
}
