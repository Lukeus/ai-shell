import React from 'react';

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

  if (segments.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center border-b text-secondary"
      style={{
        height: 'var(--vscode-breadcrumbs-height, var(--vscode-list-rowHeight))',
        backgroundColor: 'var(--vscode-editor-background)',
        borderColor: 'var(--vscode-border-subtle)',
        fontSize: 'var(--vscode-font-size-ui)',
        paddingLeft: 'var(--vscode-space-2)',
        paddingRight: 'var(--vscode-space-2)',
      }}
      aria-label="Breadcrumbs"
    >
      <nav className="flex items-center min-w-0 overflow-x-auto hide-scrollbar gap-1">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const content = (
            <>
              {segment.icon && <span className="flex items-center">{segment.icon}</span>}
              <span className="truncate">{segment.label}</span>
            </>
          );

          const commonClassName = `flex items-center gap-1 px-1.5 rounded-sm ${
            isLast ? 'text-primary' : 'text-secondary'
          }`;

          return (
            <span key={segment.id} className="flex items-center min-w-0">
              {segment.onClick ? (
                <button
                  type="button"
                  onClick={segment.onClick}
                  title={segment.title ?? segment.label}
                  className={`${commonClassName} hover:text-primary`}
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = 'var(--vscode-hover-background)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {content}
                </button>
              ) : (
                <span title={segment.title ?? segment.label} className={commonClassName}>
                  {content}
                </span>
              )}
              {!isLast && (
                <span
                  className="codicon codicon-chevron-right text-tertiary mx-1"
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
