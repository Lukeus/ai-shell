import type { ConnectionProvider } from 'packages-api-contracts';
import { ConnectionProviderSchema } from 'packages-api-contracts';

type ConnectionProviderListener = (provider: ConnectionProvider) => void;

const providers = new Map<string, ConnectionProvider>();
const listeners = new Set<ConnectionProviderListener>();

export function registerConnectionProvider(provider: ConnectionProvider): ConnectionProvider {
  const validated = ConnectionProviderSchema.parse(provider);
  providers.set(validated.id, validated);
  listeners.forEach((listener) => listener(validated));
  return validated;
}

export function registerConnectionProviders(
  nextProviders: ConnectionProvider[]
): ConnectionProvider[] {
  return nextProviders.map((provider) => registerConnectionProvider(provider));
}

export function listConnectionProviders(): ConnectionProvider[] {
  return Array.from(providers.values());
}

export function onConnectionProviderRegistered(
  listener: ConnectionProviderListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
