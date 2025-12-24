# Extension SDK

The Extension SDK provides helper utilities for building ai-shell extensions.
This package currently exposes contribution helpers for connection providers.

## Connection providers

```ts
import { registerConnectionProvider } from 'packages-extension-sdk';

registerConnectionProvider({
  id: 'acme.provider',
  name: 'Acme Provider',
  fields: [
    {
      id: 'apiKey',
      label: 'API key',
      type: 'secret',
      required: true,
    },
  ],
});
```

The SDK validates connection providers against `ConnectionProviderSchema` from
`packages-api-contracts`.
