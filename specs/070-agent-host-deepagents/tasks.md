# 070 Agent Host - Deep Agents (LangChain DeepAgents) - Implementation Tasks

## Task 1: Define agent run + Deep Agents event contracts (Zod-first)
**Files to create:**
- `packages/api-contracts/src/types/agent-runs.ts`
- `packages/api-contracts/src/types/agent-events.ts`
- `packages/api-contracts/src/types/agent-tools.ts`

**Files to modify:**
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`

**Description:**
Add Zod schemas for agent run metadata, DeepAgentRunConfig, run start/control requests,
Deep Agents event payloads (plan/todos/subagents), tool call envelopes/results, and
policy decisions. Define IPC channels for agent runs, event subscriptions, and trace list.
Export types and update preload API typing.

**Verification:**
```bash
cd packages/api-contracts
pnpm typecheck
pnpm lint
```

**Done =**
- New Zod types compile and are exported; IPC channels and preload typings updated.

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
Store latest todo snapshot. Ensure audit entries are recorded for tool calls and policy
decisions with no secret payloads. Add redaction for sensitive fields.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/services/AgentRunStore.test.ts
pnpm test src/main/services/AuditService.test.ts
```

**Done =**
- Runs/events persist with caps; audits recorded; redaction covered by tests.

---

## Task 3: Implement VirtualFS (main) + broker tools for agent filesystem ops
**Files to create:**
- `apps/electron-shell/src/main/services/VirtualFs.ts`
- `apps/electron-shell/src/main/services/VirtualFs.test.ts`

**Files to modify:**
- `packages/broker-main/src/index.ts` (register vfs tools)
- `packages/broker-main/src/policy/PolicyService.ts`
- `packages/broker-main/src/policy/PolicyService.test.ts`

**Description:**
Create a VirtualFS service with mount boundaries and quotas, and expose broker-main tools:
`vfs.ls`, `vfs.read`, `vfs.write`, `vfs.edit`, `vfs.glob`, `vfs.grep`.
All vfs tool calls must be policy-gated and audited; inputs/outputs validated via api-contracts.

**Verification:**
```bash
cd apps/electron-shell
pnpm test src/main/services/VirtualFs.test.ts

cd ../../packages/broker-main
pnpm typecheck
pnpm lint
pnpm test
```

**Done =**
- VirtualFS enforces mounts/quotas; vfs tools round-trip through broker-main with policy + audit.

---

## Task 4: Wire IPC handlers + preload APIs for agent runs/events
**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/main/ipc-handlers.test.ts`
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/main/index.ts`

**Description:**
Register IPC handlers for run list/get/start/cancel/retry and trace list. Add a safe
event subscription channel for renderer. Validate all inputs with Zod schemas.
Expose read-only access to run outputs via VirtualFS (sanitized).

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/ipc-handlers.test.ts
```

**Done =**
- Renderer can control runs and subscribe to events; contracts validated end-to-end.

---

## Task 5: Implement Agent Host runtime using deepagentsjs + broker-client tool execution
**Files to create:**
- `apps/agent-host/src/index.ts`
- `apps/agent-host/src/runtime/DeepAgentRunner.ts`
- `apps/agent-host/src/runtime/ToolExecutor.ts`
- `apps/agent-host/src/runtime/DeepAgentRunner.test.ts`

**Files to modify:**
- `apps/agent-host/src/ipc-client.ts` (if present)
- `apps/agent-host/package.json` (add deepagentsjs dependency with pnpm)


**Description:**
Wrap deepagentsjs in Agent Host to run planning/todos, tool selection/execution, and optional
subagents. Emit Deep Agents events (plan/todos/subagents) via IPC and route all tool calls
through broker-client to main. Enforce budgets (max steps/toolcalls/wallclock).

**Verification:**
```bash
cd apps/agent-host
pnpm typecheck
pnpm lint
pnpm test
```

**Done =**
- Agent Host runs a Deep Agents loop and only uses broker tools; events emitted match contracts.

---

## Task 6: Broker-main tool routing + policy enforcement for agent calls
**Files to modify:**
- `packages/broker-main/src/index.ts`
- `packages/broker-main/src/policy/PolicyService.ts`
- `packages/broker-main/src/policy/PolicyService.test.ts`

**Description:**
Handle agent tool call envelopes, enforce policy decisions, and return validated tool results.
Ensure denials emit audit entries and deterministic errors. Categorize tools (fs/net/repo/etc.)
for policy decisions.

**Verification:**
```bash
cd packages/broker-main
pnpm typecheck
pnpm lint
pnpm test
```

**Done =**
- Agent tool calls are consistently allowed/denied with audited decisions and validated results.

---

## Task 7: Renderer Agents panel UI + plan/todos + event stream
**Files to create:**
- `apps/electron-shell/src/renderer/components/agents/AgentsPanel.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentRunList.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentPlanTodos.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentEventStream.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentsPanel.test.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/components/layout/SecondarySidebar.tsx`
- `apps/electron-shell/src/renderer/components/layout/SecondarySidebar.test.tsx`

**Description:**
Add right panel UI for agent runs, status, plan/todos, and event streaming. Wire to preload
API for run controls and read-only events. Keep layout consistent with existing Tailwind tokens.
Optionally show subagent summaries if events exist.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/agents/AgentsPanel.test.tsx
```

**Done =**
- Agents panel shows status + plan/todos + event stream in order.

---

## Task 7a: Add View menu toggle for secondary sidebar
**Files to modify:**
- `packages/api-contracts/src/ipc-channels.ts`
- `apps/electron-shell/src/main/menu.ts`
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/renderer/App.tsx`

**Description:**
Add a View menu item (with shortcut) that mirrors VS Code’s “Toggle Secondary Side Bar.”
Route the menu event through the preload allowlist and toggle the secondary sidebar in the renderer.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
```

**Done =**
- Menu toggle works and uses contract-defined IPC channel(s).

---

## Task 8: Integration + end-to-end tests for Deep Agents run flow
**Files to create:**
- `test/e2e/agent-runs.spec.ts`

**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.test.ts`
- `apps/agent-host/src/runtime/DeepAgentRunner.test.ts`

**Description:**
Cover start/cancel flow, tool call approval/denial (including vfs ops), and event stream ordering.
Assert no secret payloads are emitted or logged.

**Verification:**
```bash
pnpm -r test
pnpm test:e2e
```

**Done =**
- E2E proves run lifecycle + tool routing + event streaming + no secret leakage.

---

## Task 9: Final verification + manual QA
**Description:**
Run full checks, confirm policy gating and audit entries for tool calls (including vfs),
verify event stream updates in UI, and capture screenshots per repo rules.

**Verification:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

**Done =**
- All verification passes; manual QA confirms plan/todos display and safe outputs.

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer has no OS access.
- **P2 (Security defaults):** No secrets in logs.
- **P6 (Contracts-first):** All IPC defined in api-contracts first.
