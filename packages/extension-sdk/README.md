# Extension SDK

The Extension SDK provides helper utilities for building ai-shell extensions.
This package currently exposes contribution helpers for connection providers and agent skills.

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

## Agent skills

```ts
import { registerAgentSkill } from 'packages-extension-sdk';

registerAgentSkill({
  id: 'acme.writer',
  name: 'Acme Writer',
  description: 'Drafts concise summaries.',
  toolAllowlist: ['repo.search'],
});
```

The SDK validates agent skills against `AgentSkillDefinitionSchema` from
`packages-api-contracts`.

Delegation-capable skill example:

```ts
registerAgentSkill({
  id: 'acme.orchestrator',
  name: 'Acme Orchestrator',
  description: 'Delegates work to specialist skills.',
  delegation: {
    enabled: true,
    maxDepth: 2,
    maxDelegations: 8,
    subagents: [
      {
        name: 'reviewer',
        description: 'Reviews changes for regressions.',
        skillId: 'acme.reviewer',
      },
    ],
  },
});
```

Do not include secrets in skill definitions or delegation metadata.
