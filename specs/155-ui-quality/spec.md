# 155 - UI Quality Follow-ups

## Goals
- Improve renderer maintainability by separating sidebar view routing from ExplorerPanel.
- Remove mock diagnostics data so ProblemsView reflects live diagnostics only.
- Standardize context hook ergonomics with clear provider errors.
- Wire terminal lifecycle actions (kill/clear) from MenuBar into TerminalContext.
- Improve breadcrumbs interaction to expand/select parent directories from the bar.
- Reduce inline style usage where static styles are sufficient.
- Standardize transition effects across panel/view switches.
- Optionally persist Settings tab open state for better workflow continuity.
- Reduce tab label truncation so filenames are more readable.

## Non-goals
- No new UI library migrations.
- No new IPC channels unless existing APIs cannot support the behavior.
- No changes to Monaco integration or command execution logic.
- No visual redesign beyond the listed refinements.

## Personas
- **IDE User**: expects consistent navigation and responsive commands.
- **A11y User**: expects informative errors and consistent keyboard behavior.
- **App Maintainer**: wants clear component boundaries and reusable patterns.

## User stories
1. As a user, switching primary sidebar views is predictable and decoupled from ExplorerPanel.
2. As a user, ProblemsView only shows real diagnostics from the running app.
3. As a maintainer, missing context providers fail fast with helpful errors.
4. As a user, terminal actions from MenuBar work without manual workarounds.
5. As a user, clicking breadcrumb parents expands the file tree to that folder.
6. As a maintainer, components avoid unnecessary inline styles.
7. As a user, panel transitions feel consistent across the app.
8. As a user, the Settings tab can persist when I reopen the app (if enabled).

## Acceptance criteria
### Primary sidebar routing
- View routing (Explorer/Search/SCM/etc.) is handled in a dedicated component.
- ExplorerPanel is focused on rendering the Explorer view only.

### ProblemsView data
- No hardcoded mock diagnostics remain in the renderer.
- ProblemsView subscribes only to the diagnostics update stream.
- Empty state renders when there are no diagnostics.

### Context hooks
- Context hooks (ex: useTerminal) throw informative errors when used outside providers.
- Error messages identify the missing provider by name.

### Terminal lifecycle actions
- MenuBar actions for "Kill Terminal" and "Clear Terminal" call TerminalContext methods.
- No regressions in terminal session behavior.

### Breadcrumbs interaction
- Clicking breadcrumb directory segments expands/navigates the FileTree to the folder.
- Current file segment preserves existing behavior.

### Style extraction
- Static inline styles are moved into Tailwind utility classes when possible.
- Dynamic CSS variable usage remains inline where required.

### Transitions
- Panel/view switch animations use consistent transition utilities (ex: animate-fade-in).
- No performance regressions from added transitions.

### Settings tab persistence
- Settings tab open state can be persisted optionally.
- Behavior is scoped to a user setting or explicit localStorage key.

### Tab label width
- Tab min/max width allows filenames to remain readable without excessive truncation.

## Risks
- UI behavior changes may require updated screenshots.
- Persisting Settings tab state could conflict with workspace-specific flows.
