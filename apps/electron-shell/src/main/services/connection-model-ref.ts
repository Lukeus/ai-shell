import type { Connection } from 'packages-api-contracts';

export const getConnectionModelRef = (connection: Connection): string | undefined => {
  if (connection.metadata.providerId === 'azure-openai') {
    const deployment = connection.config.deployment;
    if (typeof deployment === 'string') {
      return deployment;
    }
  }

  const model = connection.config.model;
  return typeof model === 'string' ? model : undefined;
};
