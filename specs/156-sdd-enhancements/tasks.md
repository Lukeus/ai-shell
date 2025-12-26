# SDD Enhancements Tasks

## Task 0 - Constitution alignment preflight
**Effort**: 2-4h  
**Files**:
- `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts`
**Work**:
- Add a preflight step that validates spec/plan/tasks alignment with `memory/constitution.md`.
- Block execution with a clear error when alignment is missing.
**Verify**:
- Manual: run SDD workflow with missing or misaligned docs and confirm failure.
**Done =**
- Constitution alignment is enforced before any SDD run.

---

## Task 1 - Implement code generation step
**Effort**: 4-8h  
**Files**:
- `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts`
- `packages/agent-runtime` or related workflow helpers (as needed)
**Work**:
- Implement the code generation step with multi-file edits.
- Ensure edits are planned, previewed, and applied safely.
**Verify**:
- Manual: run SDD workflow and confirm multi-file edits.
**Done =**
- Code generation step executes with multiple file updates.

---

## Task 2 - Refactor SddPanel
**Effort**: 2-4h  
**Files**:
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- Extracted subcomponents (new files)
- `specs/156-sdd-enhancements/screenshots/task-2-sdd-panel.png`
**Work**:
- Extract subcomponents to reduce file size.
- Keep behavior unchanged.
**Verify**:
- Manual: open SDD panel and confirm layout/actions.
**Done =**
- SddPanel decomposed with screenshot.

---

## Task 3 - Dynamic context resolution
**Effort**: 2-4h  
**Files**:
- `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts`
- `packages/agent-runtime/src/workflows/sdd/sdd-paths.ts`
- `apps/agent-host/src/sdd/SddWorkflowRunner.test.ts`
**Work**:
- Replace hardcoded spec/plan/tasks paths with convention/config resolution.
- Provide clear errors when resolution fails.
**Verify**:
- Manual: run SDD workflow with and without feature id.
**Done =**
- Resolver works and hardcoded paths removed.

---

## Task 4 - Parity dashboard improvements
**Effort**: 3-6h  
**Files**:
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- Extracted parity subcomponent
- `specs/156-sdd-enhancements/screenshots/task-4-parity-dashboard.png`
**Work**:
- Add actionable drift insights (ex: reconcile action).
**Verify**:
- Manual: view parity and confirm actions.
**Done =**
- Parity dashboard updated with screenshot.

---

## Task 5 - Task advancement logic
**Effort**: 2-4h  
**Files**:
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- Task management helpers (as needed)
**Work**:
- Implement automatic task advancement when a task completes.
**Verify**:
- Manual: complete a task and confirm next task becomes active.
**Done =**
- Task advancement works.

---

## Task 6 - Trace ledger rotation
**Effort**: 2-4h  
**Files**:
- `apps/electron-shell/src/main/services/SddTraceService.ts`
**Work**:
- Add rotation or compression logic for large ledgers.
**Verify**:
- Manual: simulate large ledger and confirm rotation policy.
- Rotation must preserve a stable summary/index used by UI; no breaking changes to TraceEvent schema.
**Done =**
- Ledger rotation policy in place.

---

## Task 7 - Custom slash commands
**Effort**: 3-6h  
**Files**:
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- Configuration schema (as needed)
- `specs/156-sdd-enhancements/screenshots/task-7-slash-commands.png`
**Work**:
- Allow user-defined slash commands mapped to prompt/tool chains.
- Validate and surface errors for invalid definitions.
- Any command with write-effects must run preflight + codegen safe pipeline and be audited
**Verify**:
- Manual: define and run a custom command.
**Done =**
- Custom slash commands supported with screenshot.

---

## Task 8 - Visual trace graph
**Effort**: 4-8h  
**Files**:
- `apps/electron-shell/src/renderer/components/sdd/TraceGraph.tsx` (new)
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- `specs/156-sdd-enhancements/screenshots/task-8-trace-graph.png`
**Work**:
- Add optional visual graph for SDD provenance.
- Gate behind a toggle or feature flag.
**Verify**:
- Manual: toggle graph and confirm it renders.
**Done =**
- Trace graph view available with screenshot.
