# 165 - Multi-Agent Skill Delegation - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first: delegation schemas and run/event envelopes
**Files**:
- `packages/api-contracts/src/types/agent-skills.ts`
- `packages/api-contracts/src/types/agent-runs.ts`
- `packages/api-contracts/src/types/agent-events.ts`
- `packages/api-contracts/src/types/agent-tools.ts`
- `packages/api-contracts/src/index.ts`
- `packages/api-contracts/src/types/agent-skills.test.ts`
- `packages/api-contracts/src/types/agent-runs.test.ts`
- `packages/api-contracts/src/types/agent-events.test.ts`

**Work**:
- Add `AgentSubagentDefinition` and `AgentSkillDelegation` schemas.
- Extend `AgentSkillDefinition` with optional `delegation`.
- Extend run config/metadata schemas for resolved delegation config.
- Add delegation lifecycle events to `AgentEventSchema`.
- Add optional delegation lineage context to `ToolCallEnvelope`.
- Add and update schema tests for valid/invalid delegation shapes.

**Verify**:
- `pnpm --filter packages-api-contracts test`

**Invariants**:
- P6 (Contracts-first)
- P3 (No plaintext secrets in contracts)

---

## Task 2 - Extension contributions + SDK + bundled skill examples
**Files**:
- `apps/extension-host/src/contribution-registry.ts`
- `apps/extension-host/src/contribution-registry.test.ts`
- `packages/extension-sdk/src/contributions/agentSkills.ts`
- `packages/extension-sdk/README.md`
- `extensions/agent-skills/package.json`
- `extensions/agent-skills/skills.json`

**Work**:
- Validate and register delegation-capable `contributes.agentSkills` payloads.
- Ensure SDK helper supports delegation fields with schema validation.
- Add first-party orchestrator skill example delegating to specialist skills.

**Verify**:
- `pnpm --filter apps-extension-host test`
- `pnpm --filter packages-extension-sdk typecheck`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)
- P3 (No secrets in extension skill definitions)

---

## Task 3 - Main: delegation resolver and safe policy merge
**Files**:
- `apps/electron-shell/src/main/services/SkillsService.ts`
- `apps/electron-shell/src/main/services/agent-skill-run.ts`
- `apps/electron-shell/src/main/services/agent-skill-delegation.ts` (new)
- `apps/electron-shell/src/main/services/SkillsService.test.ts`
- `apps/electron-shell/src/main/services/agent-skill-run.test.ts`
- `apps/electron-shell/src/main/services/agent-skill-delegation.test.ts` (new)

**Work**:
- Resolve and validate referenced subagent skills from selected supervisor skill.
- Enforce cycle checks, depth limits, and delegation count limits.
- Merge supervisor/subagent tool policies with denylist precedence and no policy widening.
- Produce resolved delegation config for runtime; reject invalid graphs before run start.

**Verify**:
- `pnpm --filter apps-electron-shell test -- agent-skill`

**Invariants**:
- P1 (Main-process resolution only)
- P3 (No secrets in skill resolution)
- P6 (Contracts-first)

---

## Task 4 - IPC run start wiring for delegation metadata
**Files**:
- `apps/electron-shell/src/main/ipc/agents.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.test.ts`
- `apps/electron-shell/src/main/ipc/agents.test.ts`

**Work**:
- Inject resolved delegation config into run requests sent to agent-host.
- Persist delegation summary metadata in run store.
- Surface delegation validation failures as actionable run-start errors.

**Verify**:
- `pnpm --filter apps-electron-shell test -- agents`

**Invariants**:
- P1 (Renderer has no OS access)
- P6 (Contracts-first IPC handling)

---

## Task 5 - Agent host + runtime: DeepAgents subagent integration
**Files**:
- `apps/agent-host/src/index.ts`
- `packages/agent-runtime/src/runtime/DeepAgentRunner.ts`
- `packages/agent-runtime/src/runtime/DeepAgentRunner.test.ts`
- `packages/agent-runtime/src/runtime/ToolExecutor.ts` (if context propagation needed)

**Work**:
- Pass resolved delegation config into DeepAgents `subagents` creation.
- Emit delegation lifecycle events (start/completed/failed) from runtime.
- Attach delegation lineage to delegated tool-call envelopes for audit.
- Enforce runtime delegation depth/count safety checks.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P1 (Agent host remains separate process)
- P3 (No secret leakage in events/tool inputs)
- P6 (Runtime events conform to contracts)

---

## Task 6 - Renderer: delegation-aware skills editor and run timeline
**Files**:
- `apps/electron-shell/src/renderer/components/skills/SkillEditor.tsx`
- `apps/electron-shell/src/renderer/components/skills/SkillsPanel.tsx`
- `apps/electron-shell/src/renderer/hooks/useSkills.ts`
- `apps/electron-shell/src/renderer/components/agents/AgentsRunsView.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentsPanel.test.tsx`
- `apps/electron-shell/src/renderer/components/skills/SkillsPanel.test.tsx`
- `specs/165-multi-agent-skill-delegation/screenshots/` (new)

**Work**:
- Add delegation section in skill editor for user skills.
- Render delegation lifecycle events in run timeline with clear labels.
- Keep extension-contributed skills read-only.
- Capture screenshot for delegation UI and event visibility.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Renderer uses `window.api` only)
- P4 (Token-based styling and existing design system)
- Screenshot requirement

---

## Task 7 - Docs updates for extension authors and architecture
**Files**:
- `docs/extensions/api-reference.md`
- `docs/extensions/getting-started.md`
- `docs/architecture/architecture.md`

**Work**:
- Document delegation-capable skill schema and examples.
- Document run lifecycle and delegation event semantics.
- Update architecture flow to include supervisor -> subagent delegation path.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process boundaries documented correctly)
- P3 (Secrets handling remains main-only)

---

## Task 8 - Guardrail follow-up: split DeepAgentRunner during delegation work
**Files**:
- `packages/agent-runtime/src/runtime/DeepAgentRunner.ts`
- `packages/agent-runtime/src/runtime/delegation/*` (new)
- `packages/agent-runtime/src/runtime/events/*` (new)

**Work**:
- Split `DeepAgentRunner.ts` into focused modules (delegation builder, event emitters, backend/tool adapters).
- Keep `DeepAgentRunner.ts` as a thin orchestrator entrypoint.
- Preserve behavior parity and existing tests.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter packages-agent-runtime lint`

**Invariants**:
- Guardrails (file/component size budgets)
- P5 (No performance regressions from runtime refactor)

---

## Task 9 - Guardrail follow-up: split oversized SkillsService
**Files**:
- `apps/electron-shell/src/main/services/SkillsService.ts`
- `apps/electron-shell/src/main/services/skills-resolution/*` (new)

**Work**:
- Split `SkillsService.ts` into focused modules (run-skill resolution, workspace/global store selection, list caching).
- Keep `SkillsService.ts` as thin orchestration/service surface with stable public methods.
- Preserve behavior parity and existing tests.

**Verify**:
- `pnpm --filter apps-electron-shell test -- SkillsService`

**Invariants**:
- Guardrails (file/component size budgets)
- P1 (Main-process only skill resolution)

---

## Task 10 - Guardrail follow-up: split oversized agents IPC handler
**Files**:
- `apps/electron-shell/src/main/ipc/agents.ts`
- `apps/electron-shell/src/main/ipc/agents/*` (new)

**Work**:
- Split `agents.ts` into focused modules (run lifecycle handlers, conversation handlers, event pub/sub utilities).
- Keep IPC registration entrypoint thin and preserve existing channel behavior.
- Preserve behavior parity and existing tests.

**Verify**:
- `pnpm --filter apps-electron-shell test -- agents`

**Invariants**:
- Guardrails (file/component size budgets)
- P1 (Renderer->main IPC only, no renderer OS access)
