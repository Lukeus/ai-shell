# 151 SDD Workflow Engine - Technical Plan
## Architecture decisions
- Implement SDD as a dedicated workflow in `agent-host`:
  - `SddWorkflowRunner` orchestrates step transitions and emits typed events.
- Keep secrets in main:
  - Use feature 150’s `model.generate` broker path for LLM calls.
- Enforce “proposal-only writes”:
  - agent-host generates a `Proposal` payload (files + unified diff)
  - renderer previews and requests apply
  - main performs apply via `PatchApplyService` with audit + policy checks
- Reuse existing event streaming plumbing used for agent runs (if present); otherwise create a lightweight run event channel for SDD.

## Interfaces / contracts (Zod-first)
Add to `packages/api-contracts`:
- `SddStepSchema`: `spec | plan | tasks | implement | review`
- `SddRunStartRequest`:
  - `featureId: string`
  - `goal: string`
  - `connectionId?: uuid` (optional; default selection handled by main/settings)
  - `step?: SddStep` (optional; default is spec)
- `SddRunEvent` union:
  - started, contextLoaded, stepStarted, outputAppended, proposalReady, approvalRequired, proposalApplied, runCompleted, runFailed, testsRequested, testsCompleted
- `ProposalSchema`:
  - `writes: Array<{ path: string; content: string }>`
  - `patch?: string` (unified diff)
  - `summary: { filesChanged: number; additions?: number; deletions?: number }`
- IPC channels:
  - renderer -> main:
    - `sdd:runs:start`
    - `sdd:runs:control` (cancel/retry)
    - `sdd:proposal:apply` (apply patch/writes)
    - `sdd:tests:run` (optional, gated)
  - main -> renderer:
    - `sdd:runs:event` (event stream)
- Preload API updates to expose:
  - startSddRun, controlSddRun, applySddProposal, runSddTests, subscribeSddEvents

## Data model changes
- Add SDD run persistence (minimal):
  - `SddRunRecord` stored alongside existing run store (or reuse AgentRun with `kind: "sdd"`).
  - Persist:
    - `runId`, `featureId`, `step`, `status`, timestamps
    - `routing` (connectionId/providerId/effectiveModelRef) resolved by main
    - `proposalHistory` metadata (hash + summary), not full content (to avoid bloating)
- Audit log:
  - record apply events and model.generate invocations tied to runId.

## Main process services
- `PatchApplyService`:
  - validates proposal paths (repo root only; no traversal)
  - applies unified diff (preferred) or writes files
  - emits audit events
  - returns success/failure + conflict info
- `SddRunCoordinator` (main):
  - starts agent-host workflow run
  - routes `sdd:runs:event` stream to renderer
  - attaches resolved routing info to run records

## Agent-host workflow runtime
- `SddWorkflowRunner` responsibilities:
  - load mandatory context files (AGENTS.md list)
  - build prompts for each step (spec/plan/tasks/implement/review)
  - call `model.generate` tool via broker
  - parse outputs into:
    - markdown files
    - patch diffs (for implement)
  - emit proposal events and await approval (approval is an external event from renderer/main)
- Step prompts:
  - enforce “no implementation before spec+plan+tasks”
  - enforce “task-scoped implementation only” for `/implement <n>`
  - enforce “no secrets, no network calls” directives

## Migrations / rollout
- No DB migrations assumed; use existing local persistence mechanism.
- Feature flag SDD workflow engine in UI (optional) to allow incremental rollout.

## Test strategy
- Unit tests:
  - contract validation (Zod) for events and proposals
  - gating logic in `SddWorkflowRunner`
  - patch apply path validation and traversal protection
- Integration tests:
  - agent-host <-> main broker loop (mock model.generate)
  - proposal -> apply -> filesystem mutation (temp repo fixture)
- E2E tests (Playwright):
  - run `/spec` and approve diff; verify file created
  - run `/plan` then `/tasks`; verify gating
  - run `/implement 1`; verify patch preview and apply
  - verify audit entries exist and no secrets in payloads/logs

## Observability
- Structured logs (main and agent-host):
  - runId, featureId, step, event type, durations
- Telemetry counters:
  - sdd_step_success, sdd_step_failure, proposal_apply_success/failure
- Debug mode:
  - optionally include prompt text behind a dev-only flag; default off

## Security checklist
- [ ] No secrets in renderer/agent-host payloads
- [ ] All writes via main `PatchApplyService`
- [ ] Path traversal protection (`..`, absolute paths) enforced
- [ ] Consent gating for any secret-backed model calls (via feature 150)
- [ ] Audit events for apply + model.generate
- [ ] No shell execution without explicit user action (tests run is explicit)
