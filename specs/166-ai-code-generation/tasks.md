# 166 - AI Code Generation - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first: proposal mode and lifecycle metadata
**Files**:
- `packages/api-contracts/src/types/sdd.ts`
- `packages/api-contracts/src/types/agent-edits.ts`
- `packages/api-contracts/src/types/agent-conversations.ts`
- `packages/api-contracts/src/types/agent-events.ts` (if lifecycle events are added)
- `packages/api-contracts/src/index.ts`
- related contract tests

**Work**:
- Define the accepted proposal apply mode explicitly.
- Add persisted proposal lifecycle metadata (`pending`, `applied`, `discarded`, `failed`).
- Add any cache-key or lifecycle result contracts needed by the hardened storage model.

**Verify**:
- `pnpm --filter packages-api-contracts test`

**Invariants**:
- P6 (Contracts-first)
- P3 (No plaintext secrets in contracts)

---

## Task 2 - Main: hardened proposal persistence for conversations
**Files**:
- `apps/electron-shell/src/main/services/AgentConversationStore.ts`
- `apps/electron-shell/src/main/services/AgentEditService.ts`
- `apps/electron-shell/src/main/ipc/agent-conversation-helpers.ts`
- `apps/electron-shell/src/main/services/__tests__/AgentConversationStore.test.ts`
- `apps/electron-shell/src/main/services/__tests__/AgentEditService.test.ts`

**Work**:
- Sanitize or de-reference proposal payloads before persistence.
- Persist proposal lifecycle metadata.
- Ensure reload reconstructs proposal state safely.

**Verify**:
- `pnpm --filter apps-electron-shell test -- AgentConversationStore AgentEditService`

**Invariants**:
- P1 (Main-process persistence)
- P2 (Security defaults)
- P3 (No plaintext secrets on disk)

---

## Task 3 - Main: deterministic proposal apply behavior
**Files**:
- `apps/electron-shell/src/main/services/PatchApplyService.ts`
- `apps/electron-shell/src/main/services/PatchApplyService.test.ts`
- `apps/electron-shell/src/main/services/AgentEditService.ts`
- `apps/electron-shell/src/main/ipc/sdd.ts`

**Work**:
- Enforce the proposal apply mode contract.
- Reject invalid mixed proposals or implement explicit ordered hybrid behavior if the contract allows it.
- Persist apply/discard/failure state transitions.

**Verify**:
- `pnpm --filter apps-electron-shell test -- PatchApplyService`

**Invariants**:
- P1 (Main-process writes only)
- P2 (Workspace validation remains enforced)

---

## Task 4 - Runtime: shared proposal parser for edit and SDD flows
**Files**:
- `packages/agent-runtime/src/workflows/edit/`
- `packages/agent-runtime/src/workflows/sdd/`
- `packages/agent-runtime/src/workflows/codegen/` (new shared module if needed)
- runtime tests

**Work**:
- Consolidate shared proposal parsing and validation.
- Align edit and SDD prompts with the same accepted proposal contract.
- Fail fast on invalid proposal outputs before they reach main persistence.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P6 (Contracts-first)
- P1 (Agent host/runtime still separate from main)

---

## Task 5 - Audit and lifecycle wiring
**Files**:
- `apps/electron-shell/src/main/services/AuditService.ts`
- `apps/electron-shell/src/main/ipc/agents.ts`
- `apps/electron-shell/src/main/ipc/sdd.ts`
- audit-related tests

**Work**:
- Audit proposal apply/discard actions consistently for Agents and SDD.
- Ensure lifecycle events and persisted state stay in sync.

**Verify**:
- `pnpm --filter apps-electron-shell test -- agents sdd AuditService`

**Invariants**:
- P2 (Security defaults)
- P3 (No secrets in audit logs)

---

## Task 6 - Renderer: proposal lifecycle UI state from persisted data
**Files**:
- `apps/electron-shell/src/renderer/components/agents/AgentEditProposalCard.tsx`
- `apps/electron-shell/src/renderer/hooks/useAgentEdits.ts`
- `apps/electron-shell/src/renderer/hooks/useAgentConversations.ts`
- SDD proposal UI components as needed
- renderer tests
- `specs/166-ai-code-generation/screenshots/` (new)

**Work**:
- Render persisted proposal state instead of React-only ephemeral state.
- Surface apply/discard/failure states after reload.
- Capture screenshots for any UI changes.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Renderer uses `window.api` only)
- P4 (Existing design system)
- Screenshot requirement

---

## Task 7 - Integration and migration follow-through
**Files**:
- migration helpers in main as needed
- integration tests in `apps/electron-shell`
- docs updates in `docs/architecture/architecture.md` and relevant agent docs

**Work**:
- Migrate existing persisted proposal entries safely.
- Add integration coverage for edit and SDD proposal reload/apply behavior.
- Document the unified AI code generation contract.

**Verify**:
- `pnpm --filter apps-electron-shell test`
- `pnpm --filter packages-agent-runtime test`

**Invariants**:
- P1 (Process boundaries remain correct)
- P6 (Docs and implementation agree on contracts)
