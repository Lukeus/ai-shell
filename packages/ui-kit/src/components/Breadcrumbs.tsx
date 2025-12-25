import React, { type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';

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
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex w-max items-center text-[var(--vscode-font-size-ui)] leading-[var(--vscode-line-height-ui)] text-secondary">
        {items.map((item, index) => {
          const isCurrent = Boolean(item.current);
          const title = item.title ?? item.label;
          const elementClassName = `
            inline-flex flex-none items-center gap-1 whitespace-nowrap
            ${isCurrent ? 'text-primary' : 'text-secondary'}
            ${item.onClick || item.href ? 'hover:text-primary' : ''}
          `;
          const content = (
            <>
              {item.icon && (
                <span className="flex h-4 w-4 items-center text-tertiary">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
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
            <li key={`${item.label}-${index}`} className="flex flex-none items-center">
              {node}
              {index < items.length - 1 && (
                <ChevronRightIcon
                  className="mx-1 h-1.5 w-1.5 text-tertiary"
                  aria-hidden="true"
                  data-testid="breadcrumb-separator"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
