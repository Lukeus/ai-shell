# 156 - SDD Enhancements

## Goals
- Implement the SDD code generation step in SddWorkflowRunner with multi-file edits.
- Improve SDD panel maintainability via component extraction.
- Resolve spec/plan/task paths dynamically instead of hardcoded strings.
- Provide more actionable parity insights and task progression in the SDD panel.
- Add SDD trace durability for long-lived projects.
- Enable user-defined slash commands and optional trace visualization.

## Non-goals
- No new UI libraries or layout rewrites.
- No changes to core command execution outside SDD workflows.
- No secrets storage changes.

## Personas
- **IDE User**: wants SDD to guide tasks with clear parity feedback.
- **Maintainer**: wants clearer separation of responsibilities and testable logic.
- **Power User**: wants custom slash commands and visual insights.

## User stories
1. As a user, the SDD workflow can generate code updates across multiple files.
2. As a maintainer, SddPanel is easier to understand and modify.
3. As a user, SDD uses conventions to find spec/plan/tasks without manual wiring.
4. As a user, parity view highlights drift and offers reconciliation actions.
5. As a user, tasks advance automatically as I complete them.
6. As a maintainer, the trace ledger stays performant over long histories.
7. As a power user, I can define custom slash commands for SDD.
8. As a user, I can view the relationship between specs, tasks, and files.

## Acceptance criteria
### Constitution alignment
- SDD workflow verifies spec/plan/tasks align with `memory/constitution.md` before proceeding.
- If alignment fails, the run is blocked with a clear error message.

### Code generation step
- SddWorkflowRunner executes a code generation step with multi-file editing.
- Changes are scoped to workspace paths and honor SDD constraints.

### SddPanel refactor
- Sub-components extracted with clear props and smaller files.
- No behavior regressions in the panel.

### Dynamic context resolution
- SDD resolves spec/plan/tasks from feature conventions or configuration.
- Clear errors when resolution fails.

### Parity dashboard
- Parity view includes actionable drift insights (ex: reconcile).
- Drift actions are explicit and non-destructive by default.

### Task advancement
- Completing a task advances to the next in sequence.
- UI reflects the active task state.

### Trace ledger rotation
- SddTraceService can rotate or compress large ledgers.
- Rotation policy is explicit and documented.

### Custom slash commands
- Users can define custom slash commands mapped to prompts or tool chains.
- Validation prevents unsafe or malformed definitions.

### Visual trace graph
- Optional view renders relationships between specs, tasks, and files.
- Graph remains performant on large histories.

## Risks
- Multi-file edits increase the need for careful preview and rollback.
- Trace graph could become heavy without pruning or virtualization.
