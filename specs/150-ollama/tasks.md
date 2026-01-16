# 150 Ollama Provider + Agent Connection Routing - Tasks
## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first provider + run routing updates
- Files:
  - `packages/api-contracts/src/types/agent-runs.ts`
  - `packages/api-contracts/src/types/connections.ts`
  - `packages/api-contracts/src/ipc-channels.ts`
  - `packages/api-contracts/src/preload-api.ts`
  - `packages/api-contracts/src/index.ts`
  - add/update tests as needed
- Work:
  - Define provider listing contracts:
    - Add `ListProvidersResponseSchema` (`{ providers: ProviderDescriptor[] }`) and export it.
    - Add IPC channel(s) for provider listing (e.g. `connections:providers:list`) and wire into preload API typings.
  - Clarify provider descriptor naming without breaking existing code:
    - Alias `ProviderDescriptorSchema = ConnectionProviderSchema` and `type ProviderDescriptor = ConnectionProvider`.
  - Update agent run start + metadata contracts:
    - Add `AgentRunStartRequest.connectionId?: uuid` at the **top-level** (NOT inside `DeepAgentRunConfig`).
    - Add `AgentRunMetadata.routing?: { connectionId: uuid; providerId: string; modelRef?: string }`.
    - Keep `DeepAgentRunConfig.modelRef?: string` (already present) as the per-run override.
  - Add contract tests:
    - Start request validates with/without `connectionId` and rejects non-UUID values.
    - Run metadata validates with/without `routing` (backward compatible).
    - Provider list response contains no secret material (no `secretRef`, no secret fields).
- Verify: `pnpm --filter packages-api-contracts build`
- Invariants:
  - Contracts-first (P6)
  - No secrets in contracts or responses (P3)

## Task 2 - Provider registry service + IPC exposure
- Files:
  - `apps/electron-shell/src/main/services/ConnectionProviderRegistry.ts` (new)
  - `apps/electron-shell/src/main/ipc-handlers.ts`
  - `apps/electron-shell/src/preload/index.ts`
  - `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsPanel.tsx`
  - `apps/electron-shell/src/renderer/components/settings/connections/ProviderPicker.tsx`
  - `specs/150-ollama/screenshots/azure-openai-provider.png`
  - relevant tests
- Work:
  - Register core providers (OpenAI + Azure OpenAI + Ollama) in main via `ConnectionProviderRegistry`.
  - Expose provider list via IPC using `ListProvidersResponseSchema`.
  - Update Connections UI to consume provider list from IPC instead of hardcoded data.
  - Ensure the provider form is descriptor-driven:
    - Render fields from `provider.fields` (no hardcoded "ollama/openai" branching in JSX).
  - Cache/memoize provider list in main/preload (lightweight) to avoid UI stalls.
  - Capture a screenshot of the Connections panel showing the Azure OpenAI provider option.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - Renderer has no OS access (P1)
  - No secrets in renderer (P3)

## Task 3 - Default connection setting for agents
- Files:
  - `packages/api-contracts/src/types/settings.ts`
  - `apps/electron-shell/src/main/services/SettingsService.ts`
  - `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`
  - any new settings UI component + tests
- Work:
  - Add `agents.defaultConnectionId` (nullable) in settings contracts and persistence.
  - Add a settings UI control to select a default connection used when a run omits `connectionId`.
  - Invalid-default handling:
    - If `defaultConnectionId` points to a missing/deleted connection, treat as unset and show a warning in settings.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - Settings contain no secrets (P3)
  - UI uses token-based styling (P4)

## Task 4 - Model gateway in main + broker tool
- Files:
  - `apps/electron-shell/src/main/services/ModelGatewayService.ts` (new)
  - `apps/electron-shell/src/main/services/agent-host-manager.ts`
  - `apps/electron-shell/src/main/ipc-handlers.ts`
  - `packages/broker-main/src/index.ts`
  - relevant tests
- Work:
  - Implement `ModelGatewayService` in main:
    - Resolve `connectionId` -> connection config + provider id + (if needed) secret (main-only).
    - Apply consent checks before any secret-backed call.
    - Execute provider-specific model calls (Ollama via HTTP; OpenAI and Azure OpenAI via HTTPS).
    - Enforce timeouts and return actionable errors (unreachable endpoint, invalid model, etc.).
  - Expose a broker tool `model.generate` for agent-host:
    - Input includes `runId`, `connectionId` (optional if you choose to resolve defaults in main), prompt payload, and optional `modelRef` override.
    - Output returns model text (and optional structured tool envelope if supported later).
  - Add audit events for model calls:
    - Emit an audit entry per `model.generate` call with `{ runId, providerId, connectionId, effectiveModelRef, status, durationMs }`.
    - Do not log secrets; do not log prompt text in MVP.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - Secrets only in main (P3)
  - Policy + audit enforced (P1/P6)

## Task 5 - Agent runtime wiring for model calls
- Files:
  - `apps/agent-host/src/index.ts`
  - `packages/agent-runtime/src/runtime/DeepAgentRunner.ts`
  - `apps/electron-shell/src/renderer/components/agents/AgentsPanel.tsx`
  - relevant tests
- Work:
  - UI passes `connectionId` in start requests (optional; omitted uses default).
  - Agent runtime invokes `model.generate` via the broker tool path (no direct network calls from agent-host).
  - Ensure effective routing is persisted and surfaced:
    - Main resolves defaults + effective modelRef and sets `run.routing` (`connectionId/providerId/modelRef`).
    - UI can display the resolved routing for the run.
  - Surface errors to the UI (missing connection, consent denied, timeout/unreachable).
  - Keep scope tight: display results/errors only (no plan/todo engine requirements).
- Verify: `pnpm --filter apps/agent-host test`
- Invariants:
  - Agent-host never receives secrets (P3)
  - Tool calls are brokered (P6)

## Task 6 - E2E coverage for Ollama connection + agent run
- Files:
  - `test/e2e/agent-runs.spec.ts`
  - `test/fixtures/electron-test-app.ts`
  - optional mock server fixture
- Work:
  - E2E flow (using mocked gateway responses rather than requiring a real Ollama daemon):
    - Create Ollama connection.
    - Set `agents.defaultConnectionId`.
    - Start an agent run without specifying `connectionId` and assert it uses the default.
    - Start an agent run with an explicit `connectionId` and assert it overrides the default.
  - Assert run metadata includes routing:
    - `routing.connectionId/providerId/modelRef` match expected effective values.
  - Assert audit was written for model calls (at least status + ids; no prompt text).
- Verify: `pnpm test:e2e`
- Invariants:
  - No secret leakage in logs/events (P3)
  - Renderer uses preload API only (P1)

## Task 7 - Settings tab integration + layout consistency
- Files:
  - `apps/electron-shell/src/renderer/App.tsx`
  - `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`
  - `apps/electron-shell/src/renderer/components/editor/EditorTabBar.tsx`
  - `apps/electron-shell/src/renderer/components/explorer/FileTreeContext.tsx`
  - `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`
  - `apps/electron-shell/src/renderer/components/settings/AgentsSettingsPanel.tsx`
  - `apps/electron-shell/src/renderer/components/explorer/FileTreeContext.test.tsx`
- Work:
  - Add a settings pseudo-tab in the open-tabs model and open it from activity bar/shortcut.
  - Render Settings in `EditorArea` when the settings tab is active.
  - Keep file-only logic (breadcrumbs, Monaco, SDD) scoped to file tabs.
  - Normalize settings header layout and remove duplicate headings.
  - Ensure settings tabs do not persist into file tab localStorage state.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - UI uses token-based styling (P4)
  - Monaco remains lazy-loaded (P5)

## Task 8 - Connection create validation + secret enforcement
- Files:
  - `packages/api-contracts/src/types/connections.ts`
  - `packages/api-contracts/src/preload-api.ts`
  - `apps/electron-shell/src/main/services/ConnectionProviderRegistry.ts`
  - `apps/electron-shell/src/main/ipc/connections.ts`
  - `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsPanel.tsx`
  - `apps/electron-shell/src/main/ipc-handlers.connections.test.ts`
- Work:
  - Allow `connections.create` to accept an optional `secretValue` for providers that require secrets.
  - Validate required non-secret fields in main before persisting connections.
  - Enforce required secrets during create for secret-backed providers.
  - Keep secrets in main only (safeStorage) and avoid logging secret payloads.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - Contracts-first (P6)
  - Secrets only in main (P3)

## Task 9 - UI validation + SDD consent preflight + visual proof
- Files:
  - `apps/electron-shell/src/renderer/components/settings/connections/ConnectionDetail.tsx`
  - `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
  - `apps/electron-shell/src/renderer/components/sdd/SddPanel.test.tsx`
  - `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsPanel.test.tsx`
  - `specs/150-ollama/screenshots/`
- Work:
  - Add required-field/secret validation in the connection form (disable save until valid).
  - Request consent before starting SDD workflow runs using the resolved connection.
  - Add/adjust tests to cover consent preflight and validation behavior.
  - Capture a screenshot showing connection validation feedback.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - Renderer uses preload API only (P1)
  - UI uses token-based styling (P4)
  - Screenshot requirement satisfied

## Task 10 - Split oversized Connections/SDD components (guardrail follow-up)
- Files:
  - `apps/electron-shell/src/renderer/components/settings/connections/ConnectionDetail.tsx`
  - `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- Work:
  - Split into container + view + hooks per guardrails.
  - Keep UI behavior identical; no new features.
  - Remove the temporary EXCEPTION comments after split.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants:
  - Guardrail budgets for component size
  - UI uses token-based styling (P4)
