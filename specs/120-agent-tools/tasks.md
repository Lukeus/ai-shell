# 120 Agent Tools - Implementation Tasks

## Task 1: Scaffold packages/agent-tools
**Files to create:**
- `packages/agent-tools/tsconfig.json`
- `packages/agent-tools/src/index.ts`
- `packages/agent-tools/src/registry.ts`
- `packages/agent-tools/src/executor.ts`
- `packages/agent-tools/src/registry.test.ts`
- `packages/agent-tools/src/executor.test.ts`

**Files to modify:**
- `packages/agent-tools/package.json`
- `eslint.config.mjs`

**Description:**
Create a shared tool registry and executor with Zod-based validation.
Wire package build/lint/test scripts similar to other Node packages.

**Verification:**
```bash
cd packages/agent-tools
pnpm typecheck
pnpm lint
pnpm test
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** Tool call envelopes remain defined in api-contracts.
- **P1 (Process isolation):** No OS access in agent-tools.
- **P6 (Contracts-first):** Use Zod schemas for tool input/output validation.

---

## Task 2: Integrate broker-main with agent-tools
**Files to modify:**
- `packages/broker-main/src/index.ts`
- `packages/broker-main/src/index.test.ts`

**Description:**
Replace broker-main internal handler map with the agent-tools registry and
executor helpers. Keep policy evaluation and audit logging in broker-main.

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

## Task 3: Wire extension/built-in tools into agent-tools registry
**Files to modify:**
- `apps/electron-shell/src/main/services/extension-tool-service.ts`
- `apps/electron-shell/src/main/services/agent-host-manager.ts`

**Description:**
Register extension tools (and any built-ins) through the shared tool registry
so broker-main can execute them via a single path.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P3 (Secrets):** Tool inputs/outputs are redacted by storage layer.
- **P6 (Contracts-first):** Tool results follow api-contracts schemas.

---

## Task 4: Update docs and QA checklist
**Files to modify:**
- `docs/architecture/architecture.md`
- `specs/120-agent-tools/spec.md` (if scope changes)

**Description:**
Document agent-tools responsibilities and update dependency flow in architecture.

**Verification:**
```bash
pnpm lint
```
