# 070 Agent Host - Deep Agents - Implementation Tasks

## Task 1: Define agent run + tool call contracts (Zod-first)
**Files to create:**
- `packages/api-contracts/src/types/agent-runs.ts`
- `packages/api-contracts/src/types/agent-events.ts`
- `packages/api-contracts/src/types/agent-tools.ts`

**Files to modify:**
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`

**Description:**
Add Zod schemas for agent run metadata, run start/control requests, agent event
payloads, tool call envelopes, and policy decisions. Define IPC channels for
agent runs, event subscriptions, and trace list. Export types and update preload
API typing.

**Verification:**
```bash
cd packages/api-contracts
pnpm typecheck
pnpm lint
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** All IPC/tool contracts defined in api-contracts first.
- **P1 (Process isolation):** Preload API stays minimal; no OS access.

---

## Task 2: Implement main AgentRunStore + Trace/Audit integration
**Files to create:**
- `apps/electron-shell/src/main/services/AgentRunStore.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.test.ts`

**Files to modify:**
- `apps/electron-shell/src/main/services/AuditService.ts`
- `apps/electron-shell/src/main/services/AuditService.test.ts`

**Description:**
Persist agent run metadata and append-only trace events with bounded retention.
Ensure audit entries are recorded for tool calls and policy decisions with no
secret payloads. Add redaction for sensitive fields.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/services/AgentRunStore.test.ts
pnpm test src/main/services/AuditService.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Main owns OS and audit.
- **P2 (Security defaults):** No secrets in logs.
- **P3 (Secrets):** Secrets stay in main; redaction enforced.

---

## Task 3: Wire IPC handlers + preload APIs for agent runs/events
**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/main/ipc-handlers.test.ts`
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/main/index.ts`

**Description:**
Register IPC handlers for run list/get/start/cancel/retry and trace list. Add a
safe event subscription channel for renderer. Validate all inputs with Zod
schemas.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer uses contextBridge only.
- **P6 (Contracts-first):** IPC payloads validated via Zod schemas.

---

## Task 4: Implement Agent Host runtime + broker-client tool execution
**Files to create:**
- `apps/agent-host/src/index.ts`
- `apps/agent-host/src/runtime/AgentRunner.ts`
- `apps/agent-host/src/runtime/ToolExecutor.ts`
- `apps/agent-host/src/runtime/AgentRunner.test.ts`

**Files to modify:**
- `apps/agent-host/src/ipc-client.ts` (if present)

**Description:**
Build the Agent Host run state machine, emit agent events, and use broker-client
to request tool execution from main. Validate tool calls and results with
api-contracts schemas.

**Verification:**
```bash
cd apps/agent-host
pnpm typecheck
pnpm lint
pnpm test
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Agent Host runs in a separate process with no OS access.
- **P6 (Contracts-first):** Tool call envelopes follow Zod schemas.

---

## Task 5: Broker-main tool routing + policy enforcement for agent calls
**Files to modify:**
- `packages/broker-main/src/index.ts`
- `packages/broker-main/src/policy/PolicyService.ts`
- `packages/broker-main/src/policy/PolicyService.test.ts`

**Description:**
Handle agent tool call envelopes, enforce policy decisions, and return validated
tool results. Ensure denial emits audit entries and deterministic errors.

**Verification:**
```bash
cd packages/broker-main
pnpm typecheck
pnpm lint
pnpm test
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Only main/broker-main touches OS.
- **P2 (Security defaults):** No secret values in logs.

---

## Task 6: Renderer Agents panel UI + event stream
**Files to create:**
- `apps/electron-shell/src/renderer/components/agents/AgentsPanel.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentRunList.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentEventStream.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentsPanel.test.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/components/layout/SecondarySidebar.tsx`
- `apps/electron-shell/src/renderer/components/layout/SecondarySidebar.test.tsx`

**Description:**
Add right panel UI for agent runs, status, and event streaming. Wire to preload
API for run controls and read-only events. Keep layout consistent with existing
Tailwind tokens.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/agents/AgentsPanel.test.tsx
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer reads events only; no OS access.
- **P4 (UI design system):** Tailwind tokens and CSS vars only.

---

## Task 6a: Add View menu toggle for secondary sidebar
**Files to modify:**
- `packages/api-contracts/src/ipc-channels.ts`
- `apps/electron-shell/src/main/menu.ts`
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/renderer/App.tsx`

**Description:**
Add a View menu item (with shortcut) that mirrors VS Code’s “Toggle Secondary
Side Bar.” Route the menu event through the preload allowlist and toggle the
secondary sidebar in the renderer.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer toggles layout only; no OS access.
- **P6 (Contracts-first):** IPC channel constants defined in api-contracts.

---

## Task 7: Integration + end-to-end tests for agent run flow
**Files to create:**
- `test/e2e/agent-runs.spec.ts`

**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.test.ts`
- `apps/agent-host/src/runtime/AgentRunner.test.ts`

**Description:**
Cover start/cancel flow, tool call approval/denial, and event stream ordering.
Assert no secret payloads are emitted or logged.

**Verification:**
```bash
pnpm -r test
pnpm test:e2e
```

**Invariants (Constitution):**
- **P3 (Secrets):** Tests must not log or print secrets.
- **P6 (Contracts-first):** Tests validate contracts at boundaries.

---

## Task 8: Final verification + manual QA
**Description:**
Run full checks, confirm policy gating and audit entries for tool calls, verify
event stream updates in UI, and capture screenshots per WARP rules.

**Verification:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer has no OS access.
- **P2 (Security defaults):** No secrets in logs.
- **P6 (Contracts-first):** All IPC defined in api-contracts first.
