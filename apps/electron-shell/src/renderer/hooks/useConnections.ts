import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Connection } from 'packages-api-contracts';

type UseConnectionsResult = {
  connections: Connection[];
  connectionOptions: Array<{ value: string; label: string }>;
  connectionLookup: Map<string, Connection>;
  selectedConnectionId: string;
  setSelectedConnectionId: (value: string) => void;
  isLoading: boolean;
  error: string | null;
};

export function useConnections(): UseConnectionsResult {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshConnections = useCallback(async () => {
    try {
      setError(null);
      const response = await window.api.connections.list();
      setConnections(response.connections);
    } catch {
      setError('Failed to load connections.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    if (
      selectedConnectionId &&
      !connections.some((connection) => connection.metadata.id === selectedConnectionId)
    ) {
      setSelectedConnectionId('');
    }
  }, [connections, selectedConnectionId]);

  const connectionOptions = useMemo(() => {
    if (isLoading) {
      return [{ value: '', label: 'Loading connections...' }];
    }

    const baseOptions = [{ value: '', label: 'Use default connection' }];
    const connectionOptionList = connections.map((connection) => ({
      value: connection.metadata.id,
      label: `${connection.metadata.displayName} (${connection.metadata.providerId})`,
    }));

    return baseOptions.concat(connectionOptionList);
  }, [connections, isLoading]);

  const connectionLookup = useMemo(() => {
    return new Map(connections.map((connection) => [connection.metadata.id, connection]));
  }, [connections]);

  return {
    connections,
    connectionOptions,
    connectionLookup,
    selectedConnectionId,
    setSelectedConnectionId,
    isLoading,
    error,
  };
}
