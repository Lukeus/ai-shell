import React from 'react';
import { Badge, type BadgeVariant } from 'packages-ui-kit';

type SddBadgeStatus = 'tracked' | 'untracked';

interface SddBadgeProps {
  status: SddBadgeStatus;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  as?: 'button' | 'span';
}

const STATUS_CONFIG: Record<SddBadgeStatus, { label: string; variant: BadgeVariant }> = {
  tracked: { label: 'Tracked', variant: 'success' },
  untracked: { label: 'Untracked', variant: 'warning' },
};

export function SddBadge({ status, title, onClick, as }: SddBadgeProps) {
  const { label, variant } = STATUS_CONFIG[status];
  const elementType = as ?? (onClick ? 'button' : 'span');
  const interactiveClassName = onClick ? 'cursor-pointer hover:bg-surface-hover' : '';

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
          className={interactiveClassName}
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
      className={interactiveClassName}
    />
  );
}
