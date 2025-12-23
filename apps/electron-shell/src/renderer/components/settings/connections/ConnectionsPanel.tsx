import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Connection,
  ConnectionProvider,
  ConnectionScope,
} from 'packages-api-contracts';
import { ConnectionsProvider } from '../../../contexts/ConnectionsContext';
import { ConnectionsList } from './ConnectionsList';
import { ConnectionDetail, type ConnectionFormValues } from './ConnectionDetail';

const normalizeScope = (scope: ConnectionScope) => scope;

export function ConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'view'>('view');
  const [isLoading, setIsLoading] = useState(true);
  const [isProvidersLoading, setIsProvidersLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ConnectionProvider[]>([]);

  const selectedConnection = useMemo(
    () => connections.find((item) => item.metadata.id === selectedId) ?? null,
    [connections, selectedId]
  );

  const refreshProviders = useCallback(async () => {
    try {
      setError(null);
      const response = await window.api.connections.listProviders();
      setProviders(response.providers);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError('Failed to load connection providers.');
    } finally {
      setIsProvidersLoading(false);
    }
  }, []);

  const refreshConnections = useCallback(
    async (preferredSelection?: string | null) => {
      try {
        setError(null);
        const response = await window.api.connections.list();
        setConnections(response.connections);

        if (preferredSelection !== undefined) {
          setSelectedId(preferredSelection);
          return;
        }

        if (!selectedId && response.connections.length > 0) {
          setSelectedId(response.connections[0].metadata.id);
        }
      } catch (err) {
        console.error('Failed to load connections:', err);
        setError('Failed to load connections.');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedId]
  );

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    void refreshProviders();
  }, [refreshProviders]);

  const handleSelect = useCallback((connectionId: string) => {
    setMode('view');
    setSelectedId(connectionId);
  }, []);

  const handleCreateClick = useCallback(() => {
    setMode('create');
    setSelectedId(null);
  }, []);

  const handleCreate = useCallback(
    async (values: ConnectionFormValues) => {
      try {
        setIsBusy(true);
        setError(null);

        const response = await window.api.connections.create({
          providerId: values.providerId,
          scope: normalizeScope(values.scope),
          displayName: values.displayName,
          config: values.config,
        });

        const connectionId = response.connection.metadata.id;

        if (values.secretValue) {
          await window.api.connections.setSecret({
            connectionId,
            secretValue: values.secretValue,
          });
        }

        setMode('view');
        await refreshConnections(connectionId);
      } catch (err) {
        console.error('Failed to create connection:', err);
        setError('Failed to create connection.');
      } finally {
        setIsBusy(false);
      }
    },
    [refreshConnections]
  );

  const handleUpdate = useCallback(
    async (connectionId: string, values: ConnectionFormValues) => {
      try {
        setIsBusy(true);
        setError(null);

        await window.api.connections.update({
          id: connectionId,
          displayName: values.displayName,
          config: values.config,
        });

        await refreshConnections(connectionId);
      } catch (err) {
        console.error('Failed to update connection:', err);
        setError('Failed to update connection.');
      } finally {
        setIsBusy(false);
      }
    },
    [refreshConnections]
  );

  const handleDelete = useCallback(
    async (connectionId: string) => {
      try {
        setIsBusy(true);
        setError(null);
        await window.api.connections.delete({ id: connectionId });
        setMode('view');
        await refreshConnections(null);
      } catch (err) {
        console.error('Failed to delete connection:', err);
        setError('Failed to delete connection.');
      } finally {
        setIsBusy(false);
      }
    },
    [refreshConnections]
  );

  const handleReplaceSecret = useCallback(
    async (connectionId: string, secretValue: string) => {
      try {
        setIsBusy(true);
        setError(null);
        await window.api.connections.replaceSecret({ connectionId, secretValue });
      } catch (err) {
        console.error('Failed to replace secret:', err);
        setError('Failed to replace secret.');
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  return (
    <ConnectionsProvider connections={connections}>
      <div className="flex h-full">
        <ConnectionsList
          connections={connections}
          providers={providers}
          selectedId={selectedId}
          onSelect={handleSelect}
          onCreate={handleCreateClick}
        />

        <div className="flex-1 flex flex-col">
          {isLoading || isProvidersLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-secondary">
              Loading connections...
            </div>
          ) : (
            <>
              {error && (
                <div className="px-6 py-2 text-xs text-status-error border-b border-border">
                  {error}
                </div>
              )}
              <ConnectionDetail
                key={`${mode}:${selectedConnection?.metadata.id ?? 'new'}`}
                mode={mode}
                connection={selectedConnection}
                providers={providers}
                isBusy={isBusy}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onReplaceSecret={handleReplaceSecret}
              />
            </>
          )}
        </div>
      </div>
    </ConnectionsProvider>
  );
}
