# 158 - IPC Hardening and Agent Controls - Tasks

## Task 1 - Update api-contracts for extension IPC Result envelopes
**Files**:
- `packages/api-contracts/src/types/extension-commands.ts` (new)
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`

**Work**:
- Add ExtensionExecuteCommandRequest schema (commandId + args).
- Update PreloadAPI extension methods to return Result envelopes.
- Export new schemas/types.

**Verify**:
- `pnpm --filter packages-api-contracts typecheck`
- `pnpm --filter packages-api-contracts lint`

**Invariants**:
- P6 (Contracts-first)
- P2 (Security defaults)

---

## Task 2 - Extension IPC handler hardening + renderer handling
**Files**:
- `apps/electron-shell/src/main/ipc/extensions.ts` (new)
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/renderer/components/command-palette/CommandPalette.tsx`

**Work**:
- Extract extension IPC handlers into `ipc/extensions.ts`.
- Use handleSafe with Zod validation and Result envelopes.
- Use invokeSafe in preload for extension execute/permission.
- Handle Result errors in command palette execution flow.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 3 - Agent run cancel/retry wiring + event resilience
**Files**:
- `apps/electron-shell/src/main/ipc/agents.ts` (new)
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.test.ts`
- `apps/electron-shell/src/main/services/agent-host-manager.ts`
- `apps/agent-host/src/index.ts`

**Work**:
- Extract agent IPC handlers and event publish bridge into `ipc/agents.ts`.
- Add in-memory cache for last AgentRunStartRequest per run ID.
- Implement cancel control message to agent-host (DeepAgentRunner.cancelRun).
- Implement retry by clearing stored events and re-running cached request.
- Guard appendAndPublish against store failures and log diagnostics safely.

**Verify**:
- `pnpm --filter apps-electron-shell test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P1 (Process isolation)
- P2 (Security defaults)
- P6 (Contracts-first)

---

## Task 4 - Defer Monaco worker setup
**Files**:
- `apps/electron-shell/src/renderer/main.tsx`
- `apps/electron-shell/src/renderer/components/editor/EditorLoader.tsx`

**Work**:
- Remove eager monacoWorkers import from renderer entry.
- Dynamically import monacoWorkers before MonacoEditor loads.

**Verify**:
- Manual: load editor and confirm no initial errors.

**Invariants**:
- P5 (Performance budgets)

---

## Task 5 - Split ipc-handlers test monolith
**Files**:
- `apps/electron-shell/src/main/ipc-handlers.test.ts`

**Work**:
- Split the monolithic test file into focused suites per IPC domain.
- Keep mocks scoped to each suite to reduce setup overhead.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- Guardrails (anti-monolith)

---

## Task 6 - Sandbox Extension Host with VM/isolate
**Files**:
- `apps/extension-host/src/extension-loader.ts`
- `apps/extension-host/src/extension-runtime.ts`
- `apps/extension-host/src/index.ts`

**Work**:
- Load extension modules in a VM context (no Node built-ins).
- Provide a minimal CommonJS wrapper and curated Extension API only.
- Disallow `require`, `process`, and native module access inside extension code.

**Verify**:
- `pnpm --filter apps-extension-host test`

**Invariants**:
- P1 (Process isolation)
- P2 (Security defaults)

---

## Task 7 - Wire extension registration + activation + contributions
**Files**:
- `apps/electron-shell/src/main/index.ts`
- `apps/electron-shell/src/main/services/extension-command-service.ts`
- `apps/electron-shell/src/main/services/extension-view-service.ts`
- `apps/electron-shell/src/main/services/extension-tool-service.ts`

**Work**:
- Register enabled extensions with Extension Host on startup.
- Fetch contributions and populate command/view/tool services.
- Activate extension on demand before executing commands/tools/views.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 8 - Validate extension tool schemas
**Files**:
- `apps/electron-shell/src/main/services/agent-host-manager.ts`
- `apps/electron-shell/src/main/services/extension-tool-service.ts`
- `packages/api-contracts/src/types/extension-contributions.ts`

**Work**:
- Validate extension tool inputs/outputs against declared JSON Schema.
- Register per-tool schemas with BrokerMain tool definitions.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P6 (Contracts-first)

---

## Task 9 - Allowlist fix for backend tools
**Files**:
- `packages/agent-runtime/src/runtime/DeepAgentRunner.ts`

**Work**:
- Treat backend tools (e.g., `repo.list`) as reserved for allowlist checks.

**Verify**:
- `pnpm --filter packages-agent-runtime test`

**Invariants**:
- P1 (Process isolation)
