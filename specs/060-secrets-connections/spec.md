# 060 Secrets + Connections
## Problem / Why
The shell needs a secure, user-friendly way to store secrets (API keys, tokens) and configure connections to external services (MCP servers, APIs) without exposing credentials to the renderer or extensions. Today there is no unified workflow for creating, storing, and using connection configurations. This blocks extension providers and agent tools that require credentials and makes it easy to accidentally leak secrets.

## Goals
- Provide a main-process SecretsService backed by Electron safeStorage for encrypt/decrypt.
- Define a Connections model with schema-driven fields and validation.
- Integrate Connections UI into Settings with user/workspace scopes.
- Support extension-contributed Connection Providers (schema + metadata).
- Enforce first-use consent prompts and audit secret access.
- Ensure renderer never sees plaintext secrets.

## Non-goals
- External secret managers or cloud vault integrations.
- Multi-user or enterprise policy controls (future).
- Connection auto-discovery or import from other IDEs.
- Inline secret editing in editor files.

## User stories
- As a user, I can create a connection with required fields and a secret without exposing it to the UI.
- As a user, I can update or revoke a connection and see where it is used.
- As an extension author, I can define a connection schema and read a secret handle after user consent.
- As an admin, I can audit access to secrets and see when/why they were used.

## UX requirements
- Settings section: "Connections" with list, create, edit, delete, and test actions.
- Provider cards show name, description, icon, and required fields.
- Forms are schema-driven (labels, help text, required/optional, validation).
- Secrets fields are masked and never displayed after save; allow "Replace" action only.
- Scope toggle: user vs workspace (with clear labeling).
- Consent dialog on first access per extension/tool with explicit "Allow once" and "Always allow".

## Functional requirements
- SecretsService (main-only) encrypts/decrypts secrets using safeStorage.
- Connections store holds metadata (id, providerId, scope, displayName, createdAt, updatedAt).
- Secrets stored separately from metadata; metadata references a secretRef handle.
- Extensions contribute connection providers with schema and validation.
- IPC contracts for: list connections, create/update/delete connection metadata, set/replace secret, request secret access.
- Renderer reads metadata only; secrets never pass to renderer.
- Audit log records secret access (who/when/why, no secret values).

## Security requirements
- Renderer has no Node access; all secrets operations in main process.
- No plaintext secrets on disk or logs.
- Secrets encrypted via safeStorage; keying managed by OS.
- Explicit consent required before any extension/tool can access a secret.
- Least-privilege: access is per-connection, per-extension/tool.
- All IPC requests validated with Zod contracts (contracts-first).

## Performance requirements
- Secrets retrieval <100ms on local machine.
- Connections list renders under 50ms for up to 200 items.
- UI does not block on secret access (async, with loading states).

## Acceptance criteria
- Connections UI exists in Settings with list and detail panes.
- Users can create, edit, delete, and replace secrets for a connection.
- Secrets are never displayed after save and never sent to renderer.
- Extensions can register providers and request access with consent flow.
- Audit log entries are created for secret access.
- IPC interfaces defined in packages/api-contracts with Zod schemas.

## Out of scope / Future work
- Enterprise policy enforcement and org-wide secret management.
- External vault integrations (Azure Key Vault, HashiCorp Vault).
- Connection sharing across machines or sync.
- Secret rotation workflows.

## Open questions
- Do we need per-workspace overrides for user connections?
- Should "test connection" run in main or extension host?
- What is the retention policy for audit logs?
