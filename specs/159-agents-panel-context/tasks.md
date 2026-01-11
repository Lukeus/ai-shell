# 159 - Agents Panel Context Conversations - Tasks

## Task 1 - Contracts-first conversation + draft schemas
**Files**:
- `packages/api-contracts/src/types/agent-conversations.ts` (new)
- `packages/api-contracts/src/types/agent-drafts.ts` (new)
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`
- `packages/api-contracts/src/ipc-channels.ts`

**Work**:
- Add schemas for AgentConversation, AgentMessage, and AgentDraft.
- Add IPC channels for conversation list/get/append and draft save.
- Expose preload API methods with Result envelopes.

**Verify**:
- `pnpm --filter packages-api-contracts typecheck`

**Invariants**:
- P6 (Contracts-first)

---

## Task 2 - Main process conversation storage + IPC handlers
**Files**:
- `apps/electron-shell/src/main/services/AgentConversationStore.ts` (new)
- `apps/electron-shell/src/main/ipc/agents.ts`
- `apps/electron-shell/src/main/ipc-handlers.ts`

**Work**:
- Implement conversation persistence with bounded retention.
- Add IPC handlers for list/get/append using handleSafe + schema validation.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 3 - Draft save service in main
**Files**:
- `apps/electron-shell/src/main/services/AgentDraftService.ts` (new)
- `apps/electron-shell/src/main/ipc/agents.ts`

**Work**:
- Validate feature folder name and prevent accidental overwrite.
- Write `spec.md`, `plan.md`, `tasks.md` into `specs/<feature>/`.
- Return Result errors on validation failures.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P2 (Security defaults)
- P6 (Contracts-first)

---

## Task 4 - Agent host planning workflow
**Files**:
- `packages/agent-runtime/src/workflows/` (new workflow)
- `apps/agent-host/src/index.ts`
- `packages/agent-runtime/src/runtime/` (wire-up)

**Work**:
- Add a planning workflow that emits AgentDraft payloads.
- Return drafts to main over existing agent event/IPC path.

**Verify**:
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 5 - Agents panel conversation UI + draft preview
**Files**:
- `apps/electron-shell/src/renderer/components/panels/AgentsPanel.tsx`
- `apps/electron-shell/src/renderer/components/agents/` (new)
- `apps/electron-shell/src/renderer/hooks/` (new)
- `apps/electron-shell/src/renderer/styles/` (new CSS modules)

**Work**:
- Add conversation list, thread view, and composer.
- Render draft preview with Save action.
- Add "Run SDD" action only when SDD is enabled.
- Capture and add screenshot.
- Implement UI using Tailwind 4 tokens and theme variables; avoid raw hex values.
- Prefer ui-kit components and existing panel patterns for layout and typography.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- UI guardrails (no library migrations)

---

## Task 6 - Integration polish + docs
**Files**:
- `docs/` (update relevant docs)

**Work**:
- Document conversation flow, draft saving, and SDD handoff.
- Ensure new API and UX flow are captured.

**Verify**:
- Manual review

**Invariants**:
- Documentation updated for new behavior

---

## Task 7 - Refactor DeepAgentRunner for guardrail compliance
**Files**:
- `packages/agent-runtime/src/runtime/DeepAgentRunner.ts`
- `packages/agent-runtime/src/runtime/` (new split modules)

**Work**:
- Split DeepAgentRunner responsibilities into focused modules (model, broker backend, todo handling).
- Preserve existing behavior and tests.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P6 (Contracts-first)
