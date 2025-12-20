# 060 Secrets + Connections - Technical Plan
## Architecture changes
- Add main-process SecretsService that wraps safeStorage for encrypt/decrypt and enforces no-logging of secret values.
- Add main-process ConnectionsService to store connection metadata (non-secret) and reference secret handles.
- Add main-process ConsentService (or extend PolicyService) to gate secret access with per-connection/per-extension approvals.
- Add main-process AuditService logging secret access events (no secret payload).
- Renderer adds Settings > Connections UI with schema-driven forms and list/detail panes.
- Extension Host exposes contribution point for Connection Providers (schema + metadata).

## Contracts (api-contracts updates)
- Add Zod types for:
  - ConnectionProvider definition (id, name, description, icon, fields schema).
  - Connection metadata (id, providerId, scope, displayName, createdAt, updatedAt).
  - SecretRef handle (opaque string).
  - Secret access request (connectionId, requesterId, reason).
  - Secret access response (granted, secretRef).
  - Audit event payloads (who/when/why, no secret).
- Add IPC channels:
  - connections:list/create/update/delete
  - connections:setSecret/replaceSecret
  - connections:requestSecretAccess
  - connections:audit:list (optional for UI)
- Update preload API typing to expose connections APIs (metadata only) and consent requests.
- Ensure contracts are added BEFORE any implementation changes.

## IPC + process boundaries
- Renderer calls main via contextBridge for:
  - Listing and managing connection metadata.
  - Setting/replacing secrets (renderer never receives plaintext back).
  - Requesting secret access (triggers consent prompt).
- Main process handles all secret storage and retrieval via safeStorage.
- Extension Host requests secret access via main process broker; receives secretRef only, not raw secret.
- Agent tools access secrets via broker-main with consent and audit logging.

## UI components and routes
- Settings area:
  - Connections list (table/cards).
  - Connection details pane with schema-driven fields and secret replace action.
  - Provider selector modal for creating new connections.
  - Consent modal for secret access requests.
- Reuse existing settings layout components; add Connections section and route.

## Data model changes
- Local storage for connection metadata (JSON now; pluggable for SQLite later).
- Secret storage via safeStorage encrypted blobs keyed by secretRef.
- Consent decisions stored per connection + requester with TTL (allow once vs always).
- Audit log persisted as append-only records (size-bounded).

## Failure modes + recovery
- safeStorage unavailable: block secret save and show error; allow metadata-only draft.
- Secret access denied: return explicit denied response; UI surfaces to caller.
- Corrupt secret blob: mark connection as invalid; prompt to replace secret.
- Consent prompt interrupted: default deny and log event.

## Testing strategy
- Unit tests:
  - SecretsService encrypt/decrypt, no plaintext storage, error paths.
  - ConnectionsService CRUD and schema validation.
  - ConsentService decisions (allow once vs always).
  - AuditService logging without secret payload.
- IPC tests:
  - Contract validation (Zod) for each IPC handler.
  - Renderer API returns metadata only.
- UI tests:
  - Connections list, create/edit/delete, replace secret flows.
  - Consent modal flow and denial handling.
- E2E:
  - Create connection, request secret access, consent allow once, verify access logged.

## Rollout / migration
- Start with JSON store for metadata + secretRef mapping.
- Add migration path to SQLite later.
- Feature-flag connections UI if needed until providers are stable.

## Risks + mitigations
- Risk: accidental secret leakage via logs or renderer props.
  - Mitigation: code review checklist and tests ensuring no secret values logged or returned.
- Risk: consent fatigue or over-broad access.
  - Mitigation: per-connection scope and allow-once default.
- Risk: safeStorage failures on some platforms.
  - Mitigation: surface error and block secret operations; document fallback not supported.

## Done definition
- Contracts added in packages/api-contracts (Zod-first) and validated.
- Connections UI functional with list/detail and secret replace.
- Secret access gated by consent prompts; audit log entries created.
- Renderer never receives plaintext secrets.
- Tests passing per strategy; verification commands defined.
  - `pnpm -r typecheck`
  - `pnpm -r lint`
  - `pnpm -r test`
