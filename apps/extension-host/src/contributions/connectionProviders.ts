import type { ConnectionProvider } from 'packages-api-contracts';
import { ConnectionProviderSchema } from 'packages-api-contracts';
import {
  listConnectionProviders,
  onConnectionProviderRegistered,
} from '../../../packages/extension-sdk/src/contributions/connectionProviders';

const CONNECTION_PROVIDERS_MESSAGE = 'connections:register-providers';

export type ConnectionProvidersMessage = {
  type: typeof CONNECTION_PROVIDERS_MESSAGE;
  providers: ConnectionProvider[];
};

const sendToMain = (message: ConnectionProvidersMessage) => {
  if (typeof process.send === 'function') {
    process.send(message);
  }
};

const validateProviders = (providers: ConnectionProvider[]) =>
  ConnectionProviderSchema.array().parse(providers);

export const registerConnectionProvidersWithMain = (
  send: (message: ConnectionProvidersMessage) => void = sendToMain
): (() => void) => {
  const existing = validateProviders(listConnectionProviders());
  if (existing.length > 0) {
    send({ type: CONNECTION_PROVIDERS_MESSAGE, providers: existing });
  }

  return onConnectionProviderRegistered((provider) => {
    const validated = ConnectionProviderSchema.parse(provider);
    send({ type: CONNECTION_PROVIDERS_MESSAGE, providers: [validated] });
  });
};
