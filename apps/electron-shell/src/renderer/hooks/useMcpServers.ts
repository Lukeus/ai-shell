import { useCallback, useEffect, useState } from 'react';
import type { McpServerListItem } from 'packages-api-contracts';

type UseMcpServersResult = {
  servers: McpServerListItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startServer: (server: McpServerListItem) => Promise<void>;
  stopServer: (server: McpServerListItem) => Promise<void>;
  isServerBusy: (server: McpServerListItem) => boolean;
};

const TRANSITIONAL_STATES = new Set(['starting', 'stopping']);

const buildServerKey = (server: McpServerListItem): string =>
  `${server.extensionId}:${server.serverId}`;

export function useMcpServers(): UseMcpServersResult {
  const [servers, setServers] = useState<McpServerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());

  const updatePending = useCallback((key: string, pending: boolean) => {
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const fetchServers = useCallback(async (initial: boolean) => {
    if (initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      setError(null);
      const response = await window.api.mcp.listServers();
      setServers(response.servers);
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
      setError('Failed to load MCP servers.');
    } finally {
      if (initial) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchServers(true);
  }, [fetchServers]);

  useEffect(() => {
    if (!servers.some((server) => TRANSITIONAL_STATES.has(server.status.state))) {
      return;
    }
    const timer = setTimeout(() => {
      void fetchServers(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [servers, fetchServers]);

  const refresh = useCallback(async () => {
    await fetchServers(false);
  }, [fetchServers]);

  const startServer = useCallback(
    async (server: McpServerListItem) => {
      const key = buildServerKey(server);
      updatePending(key, true);
      try {
        setError(null);
        const status = await window.api.mcp.startServer({
          extensionId: server.extensionId,
          serverId: server.serverId,
        });
        setServers((prev) =>
          prev.map((item) =>
            buildServerKey(item) === key
              ? { ...item, enabled: true, status }
              : item
          )
        );
        void fetchServers(false);
      } catch (err) {
        console.error('Failed to start MCP server:', err);
        setError('Failed to start MCP server.');
      } finally {
        updatePending(key, false);
      }
    },
    [fetchServers, updatePending]
  );

  const stopServer = useCallback(
    async (server: McpServerListItem) => {
      const key = buildServerKey(server);
      updatePending(key, true);
      try {
        setError(null);
        const status = await window.api.mcp.stopServer({
          extensionId: server.extensionId,
          serverId: server.serverId,
        });
        setServers((prev) =>
          prev.map((item) =>
            buildServerKey(item) === key
              ? { ...item, enabled: false, status }
              : item
          )
        );
        void fetchServers(false);
      } catch (err) {
        console.error('Failed to stop MCP server:', err);
        setError('Failed to stop MCP server.');
      } finally {
        updatePending(key, false);
      }
    },
    [fetchServers, updatePending]
  );

  const isServerBusy = useCallback(
    (server: McpServerListItem) => {
      const key = buildServerKey(server);
      return pendingKeys.has(key) || TRANSITIONAL_STATES.has(server.status.state);
    },
    [pendingKeys]
  );

  return {
    servers,
    isLoading,
    isRefreshing,
    error,
    refresh,
    startServer,
    stopServer,
    isServerBusy,
  };
}
