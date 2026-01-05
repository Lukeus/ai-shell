# Plan - UI Quality Follow-ups

## Assumptions
- Existing diagnostics IPC streams are sufficient for ProblemsView (no new IPC).
- TerminalContext exposes methods for kill/clear (or can be added without new IPC).
- Sidebar view routing exists in ExplorerPanel today and can be lifted out cleanly.
- Any persistence can use localStorage (no secrets).

## Architecture decisions
1. **Component boundary cleanup**
   - Introduce a PrimarySidebarView component to own view routing.
   - Keep ExplorerPanel limited to Explorer-specific UI.

2. **Renderer-only diagnostics**
   - Remove mock data and rely solely on diagnostics update stream.
   - Provide a clear empty state when no diagnostics exist.

3. **Context hooks standardization**
   - Align error handling with useFileTree: throw if provider is missing.

4. **Terminal actions wiring**
   - MenuBar actions call TerminalContext methods directly.

5. **Breadcrumbs navigation**
   - Expand/select directories via FileTreeContext actions from BreadcrumbsBar.

6. **Style hygiene**
   - Move static styles into Tailwind classes for readability.
   - Keep inline styles only for dynamic CSS variables.

7. **Transition consistency**
   - Apply shared transition utilities to view/panel switches.

8. **Settings tab persistence**
   - Add optional persistence via localStorage and/or existing settings.

## Implementation outline
1. Add PrimarySidebarView and refactor ExplorerPanel routing usage.
2. Strip MOCK_DIAGNOSTICS and update ProblemsView to rely on diagnostics stream.
3. Update context hooks to throw when providers are missing (useTerminal and any peers).
4. Wire MenuBar "Kill Terminal" / "Clear Terminal" to TerminalContext methods.
5. Enhance BreadcrumbsBar to expand/navigate parent directories.
6. Extract static inline styles in MenuBar/StatusBar to utility classes.
7. Normalize transition classes across panel/view switches.
8. Add optional Settings tab persistence in FileTreeContext (guarded by setting/key).
9. Adjust editor tab min/max widths to reduce filename truncation.

## Testing strategy
- Unit: update any affected tests for TabBar/StatusBar/MenuBar if needed.
- Manual: verify sidebar view switching, ProblemsView empty state, terminal actions,
  breadcrumbs navigation, and Settings tab persistence.

## Security checklist
- No Node/Electron APIs in renderer-only components.
- No secrets stored in localStorage.
- No new IPC channels unless explicitly required.
