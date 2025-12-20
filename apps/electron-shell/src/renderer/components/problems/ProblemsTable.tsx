import React from 'react';
import { VirtualizedList } from 'packages-ui-kit';
import type { Diagnostic } from 'packages-api-contracts';
import { DiagnosticRow } from './DiagnosticRow';

export interface ProblemsTableProps {
  diagnostics: Diagnostic[];
  className?: string;
  height?: string | number;
}

export function ProblemsTable({
  diagnostics,
  className = '',
  height = '100%',
}: ProblemsTableProps) {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-secondary border-b border-border bg-surface-secondary">
        <span className="w-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">Message</span>
        <span className="w-48 flex-shrink-0">File</span>
        <span className="w-16 flex-shrink-0 text-right">Line</span>
        <span className="w-24 flex-shrink-0">Source</span>
      </div>

      <div className="flex-1 overflow-hidden">
        <VirtualizedList
          items={diagnostics}
          renderItem={(diagnostic, index) => (
            <DiagnosticRow diagnostic={diagnostic} index={index} />
          )}
          estimateSize={36}
          getItemKey={(diagnostic) => diagnostic.id}
          height={height}
          scrollClassName="bg-surface"
        />
      </div>
    </div>
  );
}
