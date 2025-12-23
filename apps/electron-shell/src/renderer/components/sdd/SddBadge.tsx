import React from 'react';

type SddBadgeStatus = 'tracked' | 'untracked';

interface SddBadgeProps {
  status: SddBadgeStatus;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  as?: 'button' | 'span';
}

export function SddBadge({ status, title, onClick, as }: SddBadgeProps) {
  const label = status === 'tracked' ? 'Tracked' : 'Untracked';
  const toneClass =
    status === 'tracked'
      ? 'border-status-success text-status-success'
      : 'border-border-subtle text-status-warning';
  const baseClass =
    `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide`;

  const elementType = as ?? (onClick ? 'button' : 'span');
  const className = `${baseClass} ${toneClass}`;

  if (elementType === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`${className} hover:bg-surface-hover`}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      title={title}
      className={className}
      role={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      {label}
    </span>
  );
}
