# 157 - DeepAgents Runtime Integration - Tasks

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P3, P5, P6, P7).

## Rules
- Ordered tasks only.
- Each task lists files to change, verification commands, and invariants to protect.

## Task 1 - Update api-contracts for deepagents config and safety
**Files**:
- packages/api-contracts/src/types/agent-runs.ts
- packages/api-contracts/src/types/agent-events.ts (if needed)
- packages/api-contracts/src/types/agent-tools.ts
- packages/api-contracts/src/index.ts

**Work**:
- Extend DeepAgentRunConfig with memory settings (maxEntries, maxBytes) and optional policy overrides (allowlist, denylist).
- Add AgentMemoryConfig and AgentPolicyConfig schemas if needed.
- Document secretRef-only expectations on ToolCallEnvelope and tool inputs.

**Verify**:
- pnpm --filter packages-api-contracts typecheck
- pnpm --filter packages-api-contracts lint

**Invariants (Constitution)**:
- P6 (Contracts-first)
- P3 (Secrets)

---

## Task 2 - Implement broker-client package
**Files**:
- packages/broker-client/src/index.ts (new)
- packages/broker-client/src/transport.ts (new)
- packages/broker-client/src/index.test.ts (new)
- packages/broker-client/tsconfig.json
- packages/broker-client/vitest.config.ts

**Work**:
- Implement request/response tool-call IPC client with timeouts, correlation, and schema validation.
- Keep broker-client OS-agnostic (no fs, no Electron APIs).

**Verify**: by running:
- pnpm --filter packages-broker-client typecheck
- pnpm --filter packages-broker-client lint
- pnpm --filter packages-broker-client test

**Invariants (Constitution)**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 3 - Implement agent-memory package
**Files**:
- packages/agent-memory/src/index.ts (new)
- packages/agent-memory/src/store.ts (new)
- packages/agent-memory/src/store.test.ts (new)
- packages/agent-memory/tsconfig.json
- packages/agent-memory/vitest.config.ts

**Work**:
- Build an in-memory, run-scoped store with bounded size and safe serialization.
- No persistence; memory cleared when agent-host exits.

**Verify**: by running:
- pnpm --filter packages-agent-memory typecheck
- pnpm --filter packages-agent-memory lint
- pnpm --filter packages-agent-memory test

**Invariants (Constitution)**:
- P1 (Process isolation)
- P3 (Secrets)

---

## Task 4 - Implement agent-policy package and wire broker-main
**Files**:
- packages/agent-policy/src/index.ts (new)
- packages/agent-policy/src/PolicyService.ts (new)
- packages/agent-policy/src/PolicyService.test.ts (new)
- packages/broker-main/src/policy/PolicyService.ts
- packages/broker-main/src/index.ts
- packages/broker-main/src/policy/PolicyService.test.ts

**Work**:
- Move policy evaluation logic into agent-policy.
- broker-main consumes agent-policy and validates decisions against api-contracts.

**Verify**: by running:
- pnpm --filter packages-agent-policy test
- pnpm --filter packages-broker-main test

**Invariants (Constitution)**:
- P1 (Process isolation)
- P2 (Security defaults)
- P6 (Contracts-first)

---

## Task 5 - Implement deepagents runtime
**Files**:
- packages/agent-runtime/src/runtime/DeepAgentRunner.ts
- packages/agent-runtime/src/runtime/ToolExecutor.ts
- packages/agent-runtime/src/runtime/DeepAgentRunner.test.ts
- packages/agent-runtime/src/index.ts

**Work**:
- Integrate the deepagents library and emit plan, todo, tool, log, and status events.
- Support cancellation and timeouts; use agent-memory and broker-client transport.

**Verify**: by running:
- pnpm --filter packages-agent-runtime test

**Invariants (Constitution)**:
- P1 (Process isolation)
- P6 (Contracts-first)
- P5 (Performance budgets)

---

## Task 6 - Wire agent-host to new runtime and broker-client
**Files**:
- apps/agent-host/src/index.ts
- apps/agent-host/src (broker-client wiring as needed)
- apps/agent-host/src/sdd/SddWorkflowRunner.test.ts (if needed)

**Work**:
- Replace ad-hoc tool executor wiring with broker-client.
- Ensure tool-call/result IPC types match api-contracts; keep SDD flow intact.

**Verify**: by running:
- pnpm --filter apps-agent-host test

**Invariants (Constitution)**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 7 - Defensive redaction + validation at publish choke point
**Files**:
- apps/electron-shell/src/main/ipc-handlers.ts
- apps/electron-shell/src/main/services/AgentRunStore.ts (if needed)
- apps/electron-shell/src/main/services/AgentRunStore.test.ts
- apps/electron-shell/src/main/ipc-handlers.test.ts

**Work**:
- Validate AgentEventSchema before publish; redact sensitive fields.
- Enforce secretRef-only expectation before renderer events.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants (Constitution)**:
- P2 (Security defaults)
- P3 (Secrets)
- P6 (Contracts-first)

---

## Task 8 - Integration verification
**Files**:
- test/e2e/agent-runs.spec.ts (update)
- docs/architecture/architecture.md (if needed)

**Work**:
- Confirm tool call flow, policy denial path, and redaction in the UI stream.
- Update architecture documentation if process boundaries or IPC change.

**Verify**:
- pnpm test:e2e
- pnpm -r typecheck
- pnpm -r lint

**Invariants (Constitution)**:
- P1 (Process isolation)
- P2 (Security defaults)
- P3 (Secrets)
