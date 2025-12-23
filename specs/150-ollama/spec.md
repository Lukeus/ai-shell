# 150 Ollama Provider + Agent Connection Routing
## Problem / Why
- Agents cannot use local models today because there is no provider integration or secure model routing.
- The Connections UI uses a hardcoded provider list, which blocks provider discovery and Ollama onboarding.
- Agent runs have no stable, auditable connection selection or defaulting behavior.

## Goals
- Ship a core Ollama provider for MVP and keep OpenAI as a core provider.
- Make the provider catalog dynamic (core providers now, extension contributions later).
- Use the connection registry as the source of truth; per-run config selects `connectionId`.
- Settings provide a default connection when a run does not specify one.
- Route model calls through the main process so secrets never reach the renderer or agent-host.

## Non-goals
- Streaming responses or long-lived model sessions.
- Full extension marketplace provider discovery (only the IPC surface and registry hooks).
- A complete Deep Agents planning engine; focus is on model routing + contracts.

## User stories
- As a user, I can create an Ollama connection and run an agent against it.
- As a user, I can set a default connection and start an agent run without extra prompts.
- As an admin, I can audit which connection/model was used for each agent run.

## UX requirements
- Connections panel lists providers from the main process (no hardcoded list).
- Ollama provider defaults to `http://localhost:11434` and a default model name.
- Agents panel supports optional connection selection; if empty, the default is used.
- Clear error states: missing connection, consent denied, and unreachable model endpoint.

## Functional requirements
- Add a provider registry in main that exposes core providers (OpenAI + Ollama) and future
  extension-contributed providers via IPC.
- Extend agent run start requests to include `connectionId` and optional `modelRef`.
- Store connection selection on the run metadata for reproducibility and audit.
- Main process resolves connection config and secrets, applies consent checks, and
  executes the model request.
- Agent-host never receives decrypted secrets or raw credentials.
- `packages/api-contracts` defines ProviderDescriptor, ListProvidersResponse, and StartAgentRunRequest with connectionId?: uuid and modelRef?: string.
- Agent run persistence records connectionId, providerId, and effective modelRef used for the run.
- SDD-triggered agent runs pass connectionId (explicit or defaulted), using the same run contract as the Agents panel.
- Persist run.routing = { connectionId, providerId, modelRef? } (effective values) on the run record.

## Security requirements
- Secrets remain in main process only (safeStorage).
- No `.env` usage and no secret logging.
- Consent is required for secret access; access is audited with run id and requester id.
- Renderer and agent-host receive only connection identifiers and model outputs.

## Performance requirements
- Model calls must use timeouts and return actionable errors.
- Provider list fetch is cached or lightweight to avoid UI stalls.
- Avoid blocking the renderer; model execution stays in main or background workers.

## Acceptance criteria
- Connections panel shows OpenAI + Ollama from the provider registry.
- Users can create an Ollama connection and run an agent using it.
- Agent runs store `routing.connectionId/providerId/modelRef` and expose it in run metadata or trace.
- Model calls are executed in main with consent + audit logging.
- No secrets are exposed to renderer or agent-host (verified by tests).
- Starting an agent run without specifying connectionId uses the default connection from settings and persists the effective connectionId on the run.
- Starting an agent run with a specified connectionId overrides the default and persists the override.

## Out of scope / Future work
- Streaming model outputs and partial responses.
- Extension marketplace provider discovery and registration UX.
- Multi-model routing or advanced scheduling.

## Open questions
- Should `modelRef` live on the connection, the run config, or both?
- Do we need a user-visible "last used connection" override separate from defaults?
