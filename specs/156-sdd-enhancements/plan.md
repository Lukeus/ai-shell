# Plan - SDD Enhancements

## Assumptions
- SDD workflows already have access to file read/write operations via existing IPC/tools.
- SddWorkflowRunner can be extended without new IPC channels.
- SddTraceService persists runs in a ledger file that can be rotated/compressed.

## Architecture decisions
1. **Workflow step integration**
   - Add a dedicated code generation step in SddWorkflowRunner.
   - Support multi-file edits with explicit planning and previews.

2. **Constitution alignment gate**
   - Add a preflight check that verifies spec/plan/tasks align with `memory/constitution.md`.
   - Fail fast with a clear error when alignment is missing.

3. **Panel decomposition**
   - Extract SddPanel subcomponents for header, parity, tasks, and actions.
   - Keep business logic in a parent container.

4. **Dynamic context resolution**
   - Resolve spec/plan/tasks by convention (feature id) or config override.
   - Provide a single resolver utility used by SddWorkflowRunner.

5. **Parity dashboard actions**
   - Provide explicit reconcile actions that map to existing tools.
   - Avoid destructive defaults.

6. **Task advancement**
   - Use tasks ordering from tasks.md.
   - Update active task state when a task is completed.

7. **Trace ledger rotation**
   - Add size- or count-based rotation policy.
   - Preserve recent runs and archive older data.

8. **Custom slash commands**
   - Define a schema for user commands and validate on load.
   - Map commands to prompt templates or tool chains.

9. **Visual trace graph**
   - Render optional graph view with lightweight data model.
   - Guard with a feature flag or toggle.

## Testing strategy
- Unit tests for resolver, task advancement, and trace rotation policies.
- Manual: verify code generation, parity actions, and graph rendering.

## Security checklist
- No secrets stored in SDD state.
- All file writes remain brokered by main/IPC.
- No dynamic code execution in renderer.
