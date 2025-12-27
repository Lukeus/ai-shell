import React, { useEffect, useMemo, useState } from 'react';
import type { Diagnostic, DiagnosticsUpdateEvent, DiagnosticSeverity } from 'packages-api-contracts';
import { ProblemsTable } from './ProblemsTable';

export interface ProblemsViewProps {
  className?: string;
}

type DiagnosticSummary = {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
};

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

const formatCount = (count: number, singular: string, plural: string) =>
  count === 1 ? `${count} ${singular}` : `${count} ${plural}`;

export function ProblemsView({ className = '' }: ProblemsViewProps) {
  const [diagnosticsByKey, setDiagnosticsByKey] = useState<Map<string, Diagnostic[]>>(
    () => new Map()
  );

  useEffect(() => {
    let isMounted = true;

    const loadInitialDiagnostics = async () => {
      try {
        const response = await window.api.diagnostics.list({});
        if (!isMounted) {
          return;
        }

        setDiagnosticsByKey(() => {
          const next = new Map<string, Diagnostic[]>();
          for (const diagnostic of response.diagnostics) {
            const key = `${diagnostic.filePath}::${diagnostic.source}`;
            const existing = next.get(key) ?? [];
            existing.push(diagnostic);
            next.set(key, existing);
          }
          return next;
        });
      } catch {
        // Ignore initial diagnostics load errors; live updates still apply.
      }
    };

    const handleUpdate = (event: DiagnosticsUpdateEvent) => {
      setDiagnosticsByKey((prev) => {
        const next = new Map(prev);
        const key = `${event.filePath}::${event.source}`;

        if (event.diagnostics.length === 0) {
          next.delete(key);
        } else {
          next.set(key, event.diagnostics);
        }

        return next;
      });
    };

    void loadInitialDiagnostics();
    const unsubscribe = window.api.diagnostics.onUpdate(handleUpdate);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const diagnostics = useMemo(() => {
    const flattened: Diagnostic[] = [];
    diagnosticsByKey.forEach((items) => {
      flattened.push(...items);
    });

    return flattened.sort((a, b) => {
      const severityDelta = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDelta !== 0) return severityDelta;

      const fileDelta = a.filePath.localeCompare(b.filePath);
      if (fileDelta !== 0) return fileDelta;

      const lineDelta = a.location.startLine - b.location.startLine;
      if (lineDelta !== 0) return lineDelta;

      const columnDelta = a.location.startColumn - b.location.startColumn;
      if (columnDelta !== 0) return columnDelta;

      return a.message.localeCompare(b.message);
    });
  }, [diagnosticsByKey]);

  const summary = useMemo<DiagnosticSummary>(() => {
    return diagnostics.reduce(
      (acc, diagnostic) => {
        if (diagnostic.severity === 'error') acc.errorCount += 1;
        if (diagnostic.severity === 'warning') acc.warningCount += 1;
        if (diagnostic.severity === 'info') acc.infoCount += 1;
        if (diagnostic.severity === 'hint') acc.hintCount += 1;
        return acc;
      },
      { errorCount: 0, warningCount: 0, infoCount: 0, hintCount: 0 }
    );
  }, [diagnostics]);

  if (diagnostics.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-surface text-secondary ${className}`}>
        <span className="codicon codicon-check text-2xl mb-3 opacity-60" aria-hidden="true" />
        <p className="text-sm">No problems detected. Good work!</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-surface ${className}`}>
      <div
        className="flex items-center gap-3 px-2 border-b border-border bg-surface-elevated text-[12px]"
        style={{ height: 'var(--vscode-panelHeader-height)' }}
      >
        <span className="codicon codicon-warning text-[13px] text-secondary" aria-hidden="true" />
        <span className="text-secondary uppercase tracking-wide">Problems</span>
        <span className="text-error font-semibold">
          {formatCount(summary.errorCount, 'error', 'errors')}
        </span>
        <span className="text-warning font-semibold">
          {formatCount(summary.warningCount, 'warning', 'warnings')}
        </span>
        <span className="text-secondary font-semibold">
          {formatCount(summary.infoCount, 'info', 'infos')}
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <ProblemsTable diagnostics={diagnostics} />
      </div>
    </div>
  );
}
