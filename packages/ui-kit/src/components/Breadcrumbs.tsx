import React, { type ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  href?: string;
  current?: boolean;
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 flex-1 items-center text-[var(--vscode-font-size-small)] leading-[1.2] text-secondary">
        {items.map((item, index) => {
          const isCurrent = Boolean(item.current);
          const title = item.title ?? item.label;
          const elementClassName = `
            inline-flex min-w-0 items-center gap-1 whitespace-nowrap
            ${isCurrent ? 'text-primary' : 'text-secondary'}
            ${item.onClick || item.href ? 'hover:text-primary transition-colors' : ''}
          `;
          const content = (
            <>
              {item.icon && (
                <span className="flex h-3.5 w-3.5 items-center justify-center text-[12px] text-tertiary/80">
                  {item.icon}
                </span>
              )}
              <span className="min-w-0 max-w-[240px] truncate opacity-90">{item.label}</span>
            </>
          );

          let node: ReactNode;
          if (item.href) {
            node = (
              <a
                href={item.href}
                onClick={item.onClick}
                className={elementClassName}
                aria-current={isCurrent ? 'page' : undefined}
                title={title}
              >
                {content}
              </a>
            );
          } else if (item.onClick) {
            node = (
              <button
                type="button"
                onClick={item.onClick}
                className={elementClassName}
                aria-current={isCurrent ? 'page' : undefined}
                title={title}
              >
                {content}
              </button>
            );
          } else {
            node = (
              <span
                className={elementClassName}
                aria-current={isCurrent ? 'page' : undefined}
                title={title}
              >
                {content}
              </span>
            );
          }

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center">
              {node}
              {index < items.length - 1 && (
                <span
                  className="mx-1 text-[11px] text-tertiary"
                  aria-hidden="true"
                  data-testid="breadcrumb-separator"
                >
                  &gt;
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
