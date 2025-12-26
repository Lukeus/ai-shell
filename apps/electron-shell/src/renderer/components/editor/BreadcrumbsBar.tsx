import React from 'react';
import { Breadcrumbs, type BreadcrumbItem } from 'packages-ui-kit';

export interface BreadcrumbSegment {
  id: string;
  label: string;
  title?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface BreadcrumbsBarProps {
  fileSegments: BreadcrumbSegment[];
  symbolSegments: BreadcrumbSegment[];
}

/**
 * BreadcrumbsBar - VS Code-style breadcrumbs for file + symbol navigation.
 *
 * P4 (Tailwind 4): Uses CSS variables for colors and sizing.
 * P5 (Performance): Pure UI component, no Monaco imports (keeps lazy load intact).
 */
export function BreadcrumbsBar({ fileSegments, symbolSegments }: BreadcrumbsBarProps) {
  const segments = [...fileSegments, ...symbolSegments];
  const items: BreadcrumbItem[] = segments.map((segment, index) => ({
    label: segment.label,
    title: segment.title,
    icon: segment.icon,
    onClick: segment.onClick
      ? () => {
          segment.onClick?.();
        }
      : undefined,
    current: index === segments.length - 1,
  }));

  if (segments.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center text-secondary border-b border-border"
      style={{
        height: 'var(--vscode-breadcrumbs-height)',
        backgroundColor: 'var(--vscode-editor-background)',
        fontSize: 'var(--vscode-font-size-small)',
        paddingLeft: 'var(--vscode-space-2)',
        paddingRight: 'var(--vscode-space-2)',
      }}
    >
      <Breadcrumbs
        items={items}
        className="flex min-w-0 flex-1 items-center overflow-hidden gap-1"
      />
    </div>
  );
}
