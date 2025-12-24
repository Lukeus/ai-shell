# 151 SDD Workflow Engine (Spec-Driven Development as a First-Class Run Type)
## Problem / Why
- SDD today is mostly “docs + discipline,” but not enforced by the runtime. Agents can still attempt implementation without producing spec/plan/tasks first.
- There is no consistent, audited workflow for generating/updating `spec.md`, `plan.md`, `tasks.md`, then producing code changes as a *reviewable proposal* (diff) before applying to disk.
- File writes from an agent are high-risk without policy gates, previews, approvals, and traceability.

## Goals
- Add an **SDD Workflow Engine** that runs as a dedicated workflow in `agent-host`, orchestrated via tool calls brokered by `main`.
- Enforce **SDD gating**: no `/implement` allowed until `/spec` and `/plan` and `/tasks` exist and are valid.
- Generate changes as **proposals** (files + patch diff) that require explicit user approval before apply.
- Stream workflow events (context loaded, step started, proposal ready, approval required, applied, tests run) to the renderer SDD panel.
- Support both “button step” UX and slash-command UX: `/spec`, `/plan`, `/tasks`, `/implement <n>`, `/review`.

## Non-goals
- Deep Agents planning engine beyond SDD steps.
- Full extension marketplace integration (extensions can be integrated later as SDD step providers).
- Streaming token-by-token model outputs (event streaming is step-level; output text is chunked).
- Multi-user collaboration / sync of SDD artifacts across machines.

## Personas
- Developer: uses SDD to move from idea → spec → plan → tasks → implementation safely.
- Tech lead: reviews and approves proposed patches; wants traceability and predictable structure.
- Admin/Security: requires secrets remain in main, actions audited, and policies enforced.

## User stories
- As a developer, I can run `/spec` for a feature and get `spec.md` proposed as a diff.
- As a developer, I can run `/plan` to generate `plan.md` from `spec.md`.
- As a developer, I can run `/tasks` to generate `tasks.md` from `plan.md`.
- As a developer, I can run `/implement 3` and get a patch + tests proposed, then approve applying it.
- As a tech lead, I can review the proposal diff and approve/deny it, with audit history.
- As an admin, I can audit SDD runs: who ran what step, what files changed, and what tools were invoked.

## UX flow
1. User opens **SDD panel**.
2. User selects/enters `featureId` (e.g. `151-sdd-workflow-engine`) and goal text.
3. User runs a step:
   - Buttons: “Generate Spec”, “Generate Plan”, “Generate Tasks”, “Implement Task…”
   - Or slash commands: `/spec`, `/plan`, `/tasks`, `/implement 3`, `/review`
4. Engine loads required context (AGENTS.md mandatory context rules) and emits `context.loaded`.
5. Engine calls model via `model.generate` (brokered through main).
6. Engine emits `proposal.ready` with:
   - files to write (`spec.md`, `plan.md`, `tasks.md`, patches)
   - unified diff preview
7. UI displays diff and asks for explicit approval: “Apply”.
8. On approval, UI requests `main` to apply patch; `main` audits and writes.
9. Optional: user triggers “Run tests” (command tool) and sees results tied to the run.

## Functional requirements
- SDD workflow runs in `agent-host` as `SddRun` (separate from generic agent runs or a typed run kind).
- SDD steps supported:
  - `/spec` → propose `specs/<feature>/spec.md`
  - `/plan` → propose `specs/<feature>/plan.md`
  - `/tasks` → propose `specs/<feature>/tasks.md`
  - `/implement <taskNumber>` → propose code patch + tests for that task only
  - `/review` → evaluate implementation vs acceptance criteria and propose fixes (no auto-apply)
- Enforce gating:
  - `/plan` requires `spec.md` exists (or generated in same run and applied)
  - `/tasks` requires `plan.md` exists
  - `/implement` requires `tasks.md` exists and task number is valid
- Trace parity must ignore paths excluded by `.gitignore` and remain idle until a feature/task is selected or a run starts.
- All filesystem mutations are **proposals** until approved:
  - agent-host produces proposal payload (files + diff)
  - renderer shows preview and requests apply
  - main applies patch (policy + audit)
- Context loading must follow AGENTS.md “mandatory context loading” list; if missing, run fails with actionable error.
- Model calls must be routed through main (depends on feature 150’s `model.generate` path); agent-host never gets secrets.
- Provide consistent event stream for the renderer:
  - `sdd.run.started`
  - `sdd.context.loaded`
  - `sdd.step.started`
  - `sdd.output.appended` (chunked text logs)
  - `sdd.proposal.ready`
  - `sdd.approval.required`
  - `sdd.proposal.applied`
  - `sdd.tests.requested` / `sdd.tests.completed`
  - `sdd.run.completed` / `sdd.run.failed`

## Edge cases
- Feature folder missing → offer to create via proposal.
- Files already exist → update as patch; preserve user edits; avoid destructive overwrites.
- Git dirty working tree → warn and require confirmation before apply (or block apply).
- Patch conflicts / apply fails → surface conflict details and keep proposal for manual resolution.
- Invalid task number → error + list valid tasks.
- Model unreachable / timeout → fail step with retry option; do not partially apply.
- Large diffs → require extra confirmation; show summary + allow “apply partial” (future).

## Telemetry / Audit
- Run-level:
  - runId, featureId, step, status, durationMs, model provider/connection used
- Proposal-level:
  - files touched, diff size, approval/denial outcome
- Tool usage:
  - model.generate calls (status, duration)
  - applyPatch / writeFiles operations (status)
  - test commands invoked (exit code, duration)
- No prompt text or secrets logged by default (redaction enforced).

## Risks
- Scope creep into a full autonomous coding agent → mitigate by strict step boundaries and proposal-only writes.
- Prompt injection via repo files → mitigate by trusted-context loading rules + tool policies + no direct secret access.
- Accidental destructive edits → mitigate by unified diff preview + explicit approval + patch apply with rollback.
- Performance issues on large repos → mitigate by targeted context loading and file-level reads.

## Acceptance criteria
- SDD panel can start an SDD run and execute `/spec`, `/plan`, `/tasks`, `/implement <n>` steps.
- Gating works: `/implement` is blocked unless spec/plan/tasks exist and are valid.
- Each step produces a proposal diff; nothing is written until user approves.
- Applying a proposal writes files/patches through main with audit entries.
- Event stream updates UI in real-time (step started, output, proposal ready, applied, completed).
- Secrets never reach renderer/agent-host (verified by tests).
