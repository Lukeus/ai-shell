import React, { useMemo } from 'react';
import type { Connection, ConnectionProvider } from 'packages-api-contracts';

export interface ConnectionsListProps {
  connections: Connection[];
  providers: ConnectionProvider[];
  selectedId: string | null;
  onSelect: (connectionId: string) => void;
  onCreate: () => void;
}

export function ConnectionsList({
  connections,
  providers,
  selectedId,
  onSelect,
  onCreate,
}: ConnectionsListProps) {
  const providerNameById = useMemo(() => {
    const entries = providers.map((provider) => [provider.id, provider.name] as const);
    return new Map(entries);
  }, [providers]);

  return (
    <div className="w-64 flex-shrink-0 border-r border-border bg-surface-secondary">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-primary uppercase tracking-wide">
            Connections
          </div>
          <div className="text-[11px] text-secondary">
            {connections.length} saved
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          New
        </button>
      </div>

      <div className="max-h-full overflow-auto">
        {connections.length === 0 ? (
          <div className="px-4 py-3 text-xs text-secondary">
            No connections yet.
          </div>
        ) : (
          <ul>
            {connections.map((connection) => {
              const isActive = connection.metadata.id === selectedId;
              const providerName = providerNameById.get(connection.metadata.providerId) ?? 'Unknown';

              return (
                <li key={connection.metadata.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(connection.metadata.id)}
                    className={`
                      w-full text-left px-4 py-2
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-selection text-primary'
                        : 'text-secondary hover:bg-surface-hover hover:text-primary'
                      }
                    `}
                  >
                    <div className="text-[13px] font-medium truncate">
                      {connection.metadata.displayName}
                    </div>
                    <div className="text-[11px] text-secondary truncate">
                      {providerName}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
