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
  connections: Connection[];
}

const createRequestId = () => {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function ConnectionsProvider({ children, connections }: ConnectionsProviderProps) {
  const [queue, setQueue] = useState<PendingConsent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolversRef = useRef(new Map<string, (response: SecretAccessResponse) => void>());

  const connectionNameById = useMemo(() => {
    return new Map(connections.map((item) => [item.metadata.id, item.metadata.displayName]));
  }, [connections]);

  const requestSecretAccess = useCallback(
    (request: SecretAccessRequest) => {
      const id = createRequestId();
      const connectionName =
        connectionNameById.get(request.connectionId) ?? 'Unknown connection';

      return new Promise<SecretAccessResponse>((resolve) => {
        resolversRef.current.set(id, resolve);
        setQueue((prev) => [...prev, { id, request, connectionName }]);
      });
    },
    [connectionNameById]
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
