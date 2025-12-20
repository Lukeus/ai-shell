# 060 Secrets + Connections - Implementation Tasks

## Task 1: Define contracts for connections, secrets, and audit (Zod-first)
**Files to create:**
- `packages/api-contracts/src/types/connections.ts`
- `packages/api-contracts/src/types/secrets.ts`
- `packages/api-contracts/src/types/audit.ts`

**Files to modify:**
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`

**Description:**
Add Zod schemas for connection providers, connection metadata, secret refs, secret access requests/responses, and audit event payloads. Define IPC channel constants for connection CRUD, secret set/replace, secret access, and audit listing. Export types from api-contracts and update preload API typing.

**Verification:**
```bash
cd packages/api-contracts
pnpm typecheck
pnpm lint
pnpm test
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** All IPC contracts defined in api-contracts before implementation.
- **P1 (Process isolation):** Preload API only exposes safe IPC, no OS access.

---

## Task 2: Implement main-process SecretsService + AuditService
**Files to create:**
- `apps/electron-shell/src/main/services/SecretsService.ts`
- `apps/electron-shell/src/main/services/AuditService.ts`
- `apps/electron-shell/src/main/services/SecretsService.test.ts`
- `apps/electron-shell/src/main/services/AuditService.test.ts`

**Description:**
Create SecretsService using safeStorage for encrypt/decrypt with no plaintext logging. Add AuditService for append-only event logging (no secret values). Include error handling when safeStorage is unavailable.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/services/SecretsService.test.ts
pnpm test src/main/services/AuditService.test.ts
```

**Invariants (Constitution):**
- **P3 (Secrets):** Never store/log plaintext secrets.
- **P1 (Process isolation):** Main process only for OS-backed secrets.

---

## Task 3: Implement ConnectionsService + Consent gating
**Files to create:**
- `apps/electron-shell/src/main/services/ConnectionsService.ts`
- `apps/electron-shell/src/main/services/ConsentService.ts`
- `apps/electron-shell/src/main/services/ConnectionsService.test.ts`
- `apps/electron-shell/src/main/services/ConsentService.test.ts`

**Description:**
Store connection metadata in a local JSON store and reference secretRef handles from SecretsService. Enforce consent decisions per connection/requester (allow once vs always). Validate provider schemas when creating/updating connections.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/services/ConnectionsService.test.ts
pnpm test src/main/services/ConsentService.test.ts
```

**Invariants (Constitution):**
- **P3 (Secrets):** Metadata only in renderer; secret values stay in main.
- **P6 (Contracts-first):** IPC validation uses Zod schemas.

---

## Task 4: Wire IPC handlers and preload APIs for connections/secrets/audit
**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/main/ipc-handlers.test.ts`
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/main/index.ts`

**Description:**
Register IPC handlers for connections CRUD, secret set/replace, and secret access requests. Ensure Zod validation for all payloads. Expose safe renderer APIs via contextBridge for metadata operations only.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer uses contextBridge only; no Node access.
- **P2 (Security defaults):** Minimal preload API; validate all inputs.

---

## Task 5: Add Connections UI in Settings (list + detail + provider selector)
**Files to create:**
- `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsPanel.tsx`
- `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsList.tsx`
- `apps/electron-shell/src/renderer/components/settings/connections/ConnectionDetail.tsx`
- `apps/electron-shell/src/renderer/components/settings/connections/ProviderPicker.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`
- `apps/electron-shell/src/renderer/components/settings/SettingsCategoryNav.tsx`
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.test.tsx`

**Description:**
Implement a Settings section for Connections with list/detail panes, schema-driven forms, and replace-secret flow. Ensure no secrets are shown after save. Use existing settings layout and Tailwind 4 tokens.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/settings/SettingsPanel.test.tsx
```

**Invariants (Constitution):**
- **P4 (UI design system):** Tailwind 4 tokens and CSS vars only.
- **P1 (Process isolation):** Renderer handles metadata only.

---

## Task 6: Implement consent modal + secret access flow
**Files to create:**
- `apps/electron-shell/src/renderer/components/settings/connections/ConsentDialog.tsx`
- `apps/electron-shell/src/renderer/components/settings/connections/ConsentDialog.test.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsPanel.tsx`
- `apps/electron-shell/src/renderer/contexts/ConnectionsContext.tsx` (create if needed)

**Description:**
Add consent dialog for secret access requests with allow once/always. Route responses through main process consent service and log audit events. Ensure renderer never receives secret values.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/settings/connections/ConsentDialog.test.tsx
```

**Invariants (Constitution):**
- **P3 (Secrets):** No plaintext secrets in renderer.
- **P1 (Process isolation):** Consent handled via IPC to main.

---

## Task 7: Extension Host connection provider contributions
**Files to modify/create:**
- `apps/extension-host/src/contributions/connectionProviders.ts` (create)
- `apps/extension-host/src/index.ts`
- `packages/extension-sdk/src/contributions/connectionProviders.ts` (create)

**Description:**
Define extension contribution point for connection providers and register with main process. Ensure schema validation against api-contracts types.

**Verification:**
```bash
cd apps/extension-host
pnpm typecheck
pnpm lint
cd ../..
pnpm -r typecheck
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** Provider schemas validated with Zod types.
- **P1 (Process isolation):** Extensions communicate via broker/main only.

---

## Task 8: Add renderer tests + e2e coverage for connections flows
**Files to create:**
- `apps/electron-shell/src/renderer/components/settings/connections/ConnectionsPanel.test.tsx`
- `test/e2e/connections.spec.ts`

**Description:**
Add UI unit tests for list/detail/replace-secret flows and E2E test for connection creation and consent allow-once flow (audit entry asserted via UI).

**Verification:**
```bash
pnpm -r test
pnpm test:e2e
```

**Invariants (Constitution):**
- **P3 (Secrets):** Tests must not log or print secret values.
- **P4 (UI design system):** UI remains token-driven.

---

## Task 9: Final verification + manual QA
**Description:**
Run full checks and verify that renderer never receives secrets, consent prompts appear, and audit logs are written. Confirm no plaintext secrets are logged. Capture screenshots per WARP rules.

**Verification:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer has no OS access.
- **P3 (Secrets):** No plaintext secrets on disk or logs.
- **P6 (Contracts-first):** All IPC defined in api-contracts first.
