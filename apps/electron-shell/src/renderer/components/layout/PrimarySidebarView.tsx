import React from 'react';
import { ExplorerPanel } from './ExplorerPanel';
import { ExtensionsPanel } from '../extensions/ExtensionsPanel';
import { SearchPanel } from '../search/SearchPanel';
import { SourceControlPanel } from '../scm/SourceControlPanel';
import { SddPanel } from '../sdd/SddPanel';

interface PrimarySidebarViewProps {
  activeView?: string;
}

export function PrimarySidebarView({ activeView = 'explorer' }: PrimarySidebarViewProps) {
  const wrapView = (view: React.ReactNode) => (
    <div className="flex flex-col h-full w-full min-h-0 animate-fade-in">
      {view}
    </div>
  );

  switch (activeView) {
    case 'explorer':
      return wrapView(<ExplorerPanel />);
    case 'search':
      return wrapView(<SearchPanel />);
    case 'source-control':
      return wrapView(<SourceControlPanel />);
    case 'extensions':
      return wrapView(<ExtensionsPanel />);
    case 'sdd':
      return wrapView(<SddPanel />);
    default:
      return (
        <div className="flex flex-col h-full w-full min-h-0 bg-surface animate-fade-in">
          <div
            className="flex items-center justify-center flex-1 text-center text-secondary w-full"
            style={{
              paddingLeft: 'var(--vscode-space-4)',
              paddingRight: 'var(--vscode-space-4)',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <span className="codicon codicon-compass text-2xl opacity-50" aria-hidden="true" />
              <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
                This view is not available yet.
              </p>
            </div>
          </div>
        </div>
      );
  }
}
