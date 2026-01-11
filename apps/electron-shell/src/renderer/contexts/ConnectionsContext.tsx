import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Connection,
  ConnectionProvider,
  ConsentDecision,
  SecretAccessRequest,
  SecretAccessResponse,
} from 'packages-api-contracts';
import { ConsentDialog } from '../components/settings/connections/ConsentDialog';

type PendingConsent = {
  id: string;
  request: SecretAccessRequest;
  connectionName: string;
};

interface ConnectionsContextValue {
  requestSecretAccess: (request: SecretAccessRequest) => Promise<SecretAccessResponse>;
}

const ConnectionsContext = createContext<ConnectionsContextValue | undefined>(undefined);

interface ConnectionsProviderProps {
  children: ReactNode;
}

const createRequestId = () => {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const resolveConnectionSnapshot = async (
  connectionId: string
): Promise<{
  connection: Connection | null;
  provider: ConnectionProvider | null;
  requiresSecret: boolean;
  connectionName: string;
}> => {
  const [connectionsResponse, providersResponse] = await Promise.all([
    window.api.connections.list(),
    window.api.connections.listProviders().catch(() => ({ providers: [] })),
  ]);

  const connection =
    connectionsResponse.connections.find((item) => item.metadata.id === connectionId) ??
    null;
  const provider = connection
    ? providersResponse.providers.find(
      (item) => item.id === connection.metadata.providerId
    ) ?? null
    : null;
  const requiresSecret = provider
    ? provider.fields.some((field) => field.type === 'secret')
    : Boolean(connection?.metadata.secretRef);
  const connectionName = connection?.metadata.displayName ?? 'Unknown connection';

  return { connection, provider, requiresSecret, connectionName };
};

export function ConnectionsProvider({ children }: ConnectionsProviderProps) {
  const [queue, setQueue] = useState<PendingConsent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolversRef = useRef(new Map<string, (response: SecretAccessResponse) => void>());

  const requestSecretAccess = useCallback(
    async (request: SecretAccessRequest) => {
      const snapshot = await resolveConnectionSnapshot(request.connectionId);
      if (!snapshot.connection) {
        throw new Error(`Connection not found: ${request.connectionId}`);
      }
      if (!snapshot.requiresSecret) {
        return { granted: true };
      }
      if (!snapshot.connection.metadata.secretRef) {
        throw new Error('Connection secret is missing.');
      }

      const preflight = await window.api.connections.requestSecretAccess(request);
      if (preflight.granted) {
        return preflight;
      }

      const id = createRequestId();
      return new Promise<SecretAccessResponse>((resolve) => {
        resolversRef.current.set(id, resolve);
        setQueue((prev) => [
          ...prev,
          { id, request, connectionName: snapshot.connectionName },
        ]);
      });
    },
    []
  );

  const activeRequest = queue[0] ?? null;

  const resolveRequest = useCallback((id: string, response: SecretAccessResponse) => {
    const resolver = resolversRef.current.get(id);
    if (resolver) {
      resolver(response);
      resolversRef.current.delete(id);
    }
  }, []);

  const advanceQueue = useCallback((id: string, response: SecretAccessResponse) => {
    resolveRequest(id, response);
    setQueue((prev) => prev.slice(1));
  }, [resolveRequest]);

  const submitDecision = useCallback(
    async (decision: ConsentDecision) => {
      if (!activeRequest) return;

      setIsSubmitting(true);
      try {
        const response = await window.api.connections.requestSecretAccess({
          ...activeRequest.request,
          decision,
        });
        advanceQueue(activeRequest.id, response);
      } catch (error) {
        console.error('Failed to submit consent decision:', error);
        advanceQueue(activeRequest.id, { granted: false });
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeRequest, advanceQueue]
  );

  const contextValue = useMemo(
    () => ({
      requestSecretAccess,
    }),
    [requestSecretAccess]
  );

  return (
    <ConnectionsContext.Provider value={contextValue}>
      {children}
      {activeRequest && (
        <ConsentDialog
          isOpen={Boolean(activeRequest)}
          connectionName={activeRequest.connectionName}
          requesterId={activeRequest.request.requesterId}
          reason={activeRequest.request.reason}
          isBusy={isSubmitting}
          onAllowOnce={() => submitDecision('allow-once')}
          onAllowAlways={() => submitDecision('allow-always')}
          onDeny={() => submitDecision('deny')}
        />
      )}
    </ConnectionsContext.Provider>
  );
}

export function useConnectionsContext(): ConnectionsContextValue {
  const context = useContext(ConnectionsContext);
  if (!context) {
    throw new Error('useConnectionsContext must be used within ConnectionsProvider');
  }
  return context;
}
