import type { AgentConversation, Connection, Settings } from 'packages-api-contracts';

type ResolveAgentConnectionInput = {
  connections: Connection[];
  settings: Settings;
  explicitConnectionId?: string | null;
  conversation?: AgentConversation | null;
};

export type ResolvedAgentConnection = {
  connectionId: string | null;
  connection: Connection | null;
  usedFallback: boolean;
  missingConversationConnection: boolean;
};

export const resolveAgentConnection = ({
  connections,
  settings,
  explicitConnectionId,
  conversation,
}: ResolveAgentConnectionInput): ResolvedAgentConnection => {
  const defaultConnectionId = settings.agents.defaultConnectionId ?? null;
  const conversationConnectionId = conversation?.connectionId ?? null;
  const candidateId = explicitConnectionId ?? conversationConnectionId ?? defaultConnectionId;

  if (!candidateId) {
    return {
      connectionId: null,
      connection: null,
      usedFallback: false,
      missingConversationConnection: false,
    };
  }

  const findConnection = (id: string) =>
    connections.find((item) => item.metadata.id === id) ?? null;
  let connection = findConnection(candidateId);
  let missingConversationConnection = false;
  let usedFallback = false;

  if (!connection && conversationConnectionId && !explicitConnectionId) {
    missingConversationConnection = true;
    if (defaultConnectionId) {
      connection = findConnection(defaultConnectionId);
      if (connection) {
        usedFallback = true;
        return {
          connectionId: defaultConnectionId,
          connection,
          usedFallback,
          missingConversationConnection,
        };
      }
    }
  }

  return {
    connectionId: connection ? candidateId : null,
    connection,
    usedFallback,
    missingConversationConnection,
  };
};

export const describeMissingConnection = ({
  connections,
  settings,
  explicitConnectionId,
  conversation,
}: ResolveAgentConnectionInput): string => {
  if (explicitConnectionId) {
    return `Connection not found: ${explicitConnectionId}`;
  }

  const conversationConnectionId = conversation?.connectionId ?? null;
  if (conversationConnectionId) {
    const exists = connections.some(
      (item) => item.metadata.id === conversationConnectionId
    );
    if (!exists) {
      return `Connection not found: ${conversationConnectionId}`;
    }
  }

  const defaultConnectionId = settings.agents.defaultConnectionId ?? null;
  if (!defaultConnectionId) {
    return 'No connection configured for this run.';
  }

  return `Connection not found: ${defaultConnectionId}`;
};
