# 151 SDD Workflow Engine - Tasks
## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect
- Each task: 1–4h, independently testable, “done = …”

## Task 1 - Contracts-first SDD run + event + proposal schemas
- Files:
  - `packages/api-contracts/src/types/sdd.ts` (new)
  - `packages/api-contracts/src/ipc-channels.ts`
  - `packages/api-contracts/src/preload-api.ts`
  - `packages/api-contracts/src/index.ts`
  - tests under `packages/api-contracts/test/**` (or existing pattern)
- Work:
  - Add Zod schemas: `SddStep`, `SddRunStartRequest`, `SddRunControlRequest`, `SddRunEvent`, `Proposal`.
  - Add IPC channels for start/control/apply/tests + event stream.
  - Update preload API types for SDD.
- Verify: `pnpm --filter packages-api-contracts build`
- Invariants: contracts-first (P6); no secrets in contracts (P3)
- Done = contracts compile; tests validate event union and proposal schema.

## Task 2 - Main: PatchApplyService (proposal apply) with audit + safety checks
- Files:
  - `apps/electron-shell/src/main/services/PatchApplyService.ts` (new)
  - `apps/electron-shell/src/main/services/AuditService.ts` (existing, if present) or audit integration point
  - `apps/electron-shell/src/main/ipc-handlers.ts`
  - tests for patch apply (use temp dir fixtures)
- Work:
  - Implement apply for unified diff (preferred) and fallback file writes.
  - Enforce path safety: repo-root only, no traversal, allowlist of file extensions (optional).
  - Emit audit event: `sdd.proposal.apply` with runId + files changed + status.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants: renderer never writes directly (P1); no destructive writes without approval (P6)
- Done = applying a proposal mutates files only via main and is audited.

## Task 3 - Main: SDD IPC wiring + event relay channel
- Files:
  - `apps/electron-shell/src/main/ipc-handlers.ts`
  - `apps/electron-shell/src/preload/index.ts`
  - `apps/electron-shell/src/main/services/SddRunCoordinator.ts` (new)
- Work:
  - Implement `sdd:runs:start` and `sdd:runs:control` handlers.
  - Relay agent-host SDD events to renderer over `sdd:runs:event`.
  - Store minimal run record (status + featureId + step + routing if available).
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants: process boundaries respected; no secrets cross renderer/agent-host (P3)
- Done = renderer can start an SDD run and receive events.

## Task 4 - Agent-host: SddWorkflowRunner skeleton + gating state machine
- Files:
  - `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts` (new)
  - `packages/agent-runtime/src/workflows/sdd/prompts.ts` (new)
  - `apps/agent-host/src/index.ts` (wire workflow entry)
  - tests for gating and step transitions
- Work:
  - Implement step state machine with gating rules.
  - Implement mandatory context loading (read files list; fail if missing).
  - Emit events: started/contextLoaded/stepStarted/outputAppended.
- Verify: `pnpm --filter apps/agent-host test`
- Invariants: no filesystem writes from agent-host; proposals only (P6)
- Done = steps can run through state machine and emit events without model integration.

## Task 5 - Agent-host: model.generate integration for /spec /plan /tasks producing proposals
- Files:
  - `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts`
  - `packages/agent-runtime/src/workflows/sdd/prompts.ts`
  - tests with mocked `model.generate`
- Work:
  - For each step, call `model.generate` (broker tool) and build proposal:
    - `/spec` -> `specs/<feature>/spec.md`
    - `/plan` -> `specs/<feature>/plan.md`
    - `/tasks` -> `specs/<feature>/tasks.md`
  - Emit `proposal.ready` + `approval.required`.
- Verify: `pnpm --filter apps/agent-host test`
- Invariants: secrets remain in main; tool calls brokered (P3/P6)
- Done = proposals are generated deterministically with mock model outputs.

## Task 6 - Renderer: SDD panel wiring (start run, show events, preview proposal, approve apply)
- Files:
  - `apps/electron-shell/src/renderer/components/sdd/SDDPanel.tsx` (new or existing)
  - `apps/electron-shell/src/renderer/components/sdd/ProposalDiffView.tsx` (new)
  - `apps/electron-shell/src/renderer/components/sdd/SddRunControls.tsx` (new)
- Work:
  - UI controls for featureId + goal + step buttons + optional slash command input.
  - Subscribe to `sdd:runs:event` and render timeline/log output.
  - Render proposal diff preview and “Apply” button calling `sdd:proposal:apply`.
- Verify: `pnpm --filter apps/electron-shell test`
- Invariants: renderer uses preload API only; no direct FS (P1)
- Done = user can run `/spec` and approve a proposal from the UI.

## Task 7 - Implement step: /implement <n> produces patch proposal only (no auto-apply)
- Files:
  - `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts`
  - `packages/agent-runtime/src/workflows/sdd/prompts.ts`
  - optional patch builder utility in `packages/agent-runtime/src/utils/patch.ts`
  - tests
- Work:
  - Parse `tasks.md` to validate task number and scope.
  - Call `model.generate` to produce a unified diff patch + summary.
  - Emit proposal for code changes; require approval before apply.
- Verify: `pnpm --filter apps/agent-host test`
- Invariants: implement only touches selected task scope; no silent apply (P6)
- Done = implement step produces a patch proposal and respects gating.

## Task 8 - E2E: SDD happy path and gating
- Files:
  - `test/e2e/sdd-workflow.spec.ts` (new)
  - `test/fixtures/electron-test-app.ts`
  - mock model gateway fixture (reuse from feature 150 patterns)
- Work:
  - E2E:
    - start run -> `/spec` -> approve -> verify spec file exists
    - `/plan` -> approve -> verify plan exists
    - `/tasks` -> approve -> verify tasks exists
    - attempt `/implement 1` before tasks -> blocked
    - `/implement 1` after tasks -> proposal shown -> approve -> verify patch applied
- Verify: `pnpm test:e2e`
- Invariants: no secrets in events/logs; apply only via main (P3/P1)
- Done = end-to-end SDD workflow works and gating is enforced.
