# 150 Ollama Provider + Agent Connection Routing - Technical Plan
## Architecture changes
- Add `ConnectionProviderRegistry` in the main process to expose core providers and
  accept extension contributions in the future.
- Add `ModelGatewayService` in main to execute provider-specific model calls
  (Ollama + OpenAI) using connection config and secrets.
- Extend agent run orchestration so model calls are made via main (preferred path).
- Register a broker tool (for example `model.generate`) that the agent-host invokes
  so the main process can execute the model call without exposing secrets.

## Contracts (api-contracts updates)
- Add a provider list response schema using the existing `ConnectionProvider` shape.
- Add IPC channels for provider listing (for example `connections:providers:list`).
- Extend `AgentRunStartRequest` or `DeepAgentRunConfig` with `connectionId`
  and optional `modelRef`.
- Define a model request/response schema for the broker tool payloads.
- Update `preload-api.ts` with provider list and agent run fields.
- Define ProviderDescriptor separate from Connection:
  - ProviderDescriptor describes fields/defaults for UI rendering.
  - Connection stores providerId, config, and secretRef.
- Add resolution rules for connectionId and modelRef (precedence list).

## IPC + process boundaries
- Renderer -> Main: list providers, connections CRUD, agent run start.
- Agent-host -> Main: model tool call with `connectionId` + prompt payload.
- Main -> Agent-host: tool result (model response).
- No secrets cross into renderer or agent-host.

## UI components and routes
- Update Connections settings UI to consume provider list from IPC instead of a
  hardcoded array.
- Add a default connection selector to Settings (new Agents section or a field in
  Connections settings).
- Add an optional connection selector to the Agents panel run form.

## Data model changes
- Settings: add `agents.defaultConnectionId` (nullable, optional).
- Agent run metadata: persist `connectionId` and `modelRef` for audit.
- Audit log: capture model call events with run id, provider id, and connection id.
- Connection instance stores optional modelRef (default model for that connection).

## Failure modes + recovery
- Missing connection id: show a user-facing error and keep run in failed state.
- Consent denied: log audit entry and emit a run error event.
- Provider unreachable / timeout: return a retryable error; do not crash the run loop.
- Invalid model name: return validation error from the model gateway.

## Testing strategy
- Unit tests for provider registry and model gateway (mocked fetch).
- IPC handler tests for provider listing and model tool call path.
- Agent runtime/host tests for connection id propagation.
- E2E tests: create Ollama connection, set default, start agent run.
- Security invariant tests: renderer IPC payloads contain no secrets; agent-host never receives decrypted secrets.

## Rollout / migration
- No migration required; new settings fields are optional with defaults.
- Provide default Ollama base URL in provider descriptor.

## Risks + mitigations
- Risk: model calls block main thread -> Mitigation: async fetch + timeouts.
- Risk: secret leakage in logs -> Mitigation: strict redaction + test coverage.
- Risk: provider list divergence -> Mitigation: single registry source in main.

## Done definition
- Provider registry is IPC-backed and replaces hardcoded provider lists.
- Agent runs can select a connection (or fall back to default).
- Model calls execute in main and are audited.
- Unit + e2e tests cover the new flows.
