import React from 'react';
import type { Diagnostic, DiagnosticSeverity } from 'packages-api-contracts';

export interface DiagnosticRowProps {
  diagnostic: Diagnostic;
  index: number;
}

type SeverityMeta = {
  icon: string;
  colorClass: string;
  label: string;
};

const SEVERITY_META: Record<DiagnosticSeverity, SeverityMeta> = {
  error: {
    icon: 'codicon-error',
    colorClass: 'text-error',
    label: 'Error',
  },
  warning: {
    icon: 'codicon-warning',
    colorClass: 'text-warning',
    label: 'Warning',
  },
  info: {
    icon: 'codicon-info',
    colorClass: 'text-secondary',
    label: 'Info',
  },
  hint: {
    icon: 'codicon-light-bulb',
    colorClass: 'text-secondary',
    label: 'Hint',
  },
};

export function DiagnosticRow({ diagnostic, index }: DiagnosticRowProps) {
  const meta = SEVERITY_META[diagnostic.severity];
  const rowTone = index % 2 === 0 ? 'bg-surface' : 'bg-surface-secondary';

  return (
    <div
      data-testid="diagnostic-row"
      className={`
        flex items-center gap-3 px-4 py-2 text-sm
        border-b border-border-subtle
        ${rowTone} hover:bg-surface-hover
      `}
    >
      <span
        className={`codicon ${meta.icon} ${meta.colorClass} text-base`}
        title={meta.label}
        aria-label={meta.label}
      />

      <span
        data-testid="diagnostic-message"
        className="flex-1 min-w-0 truncate text-primary"
        title={diagnostic.message}
      >
        {diagnostic.message}
      </span>

      <span
        className="w-48 flex-shrink-0 truncate text-secondary"
        title={diagnostic.filePath}
      >
        {diagnostic.filePath}
      </span>

      <span
        className="w-16 flex-shrink-0 text-right text-secondary"
        title={`Line ${diagnostic.location.startLine}`}
      >
        {diagnostic.location.startLine}
      </span>

      <span
        className="w-24 flex-shrink-0 truncate text-secondary"
        title={diagnostic.source}
      >
        {diagnostic.source}
      </span>
    </div>
  );
}
