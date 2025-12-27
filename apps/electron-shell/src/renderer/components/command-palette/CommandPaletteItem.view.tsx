import React from 'react';
import { PaletteItem } from './useCommandPaletteItems';

interface CommandPaletteItemProps {
  item: PaletteItem;
  query: string;
}

export function CommandPaletteItem({ item, query }: CommandPaletteItemProps) {
  const highlight = (text: string) => {
    if (!query) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.split(new RegExp(`(${escapedQuery})`, 'gi')).map((part, i) => (
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-accent/30 text-primary rounded-xs px-0.5">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    ));
  };

  if (item.kind === 'command') {
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] truncate">{highlight(item.label)}</span>
          <span className="text-[11px] text-tertiary truncate">{highlight(item.commandId)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap rounded-sm border border-border-subtle bg-surface-elevated px-2 py-0.5 text-[11px] text-tertiary">
            {item.source === 'extension' ? 'Extension' : 'Built-in'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] truncate">{highlight(item.label)}</span>
        <span className="text-[11px] text-tertiary">Workspace file</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap rounded-sm border border-border-subtle bg-surface-elevated px-2 py-0.5 text-[11px] text-tertiary">
          File
        </span>
      </div>
    </div>
  );
}
