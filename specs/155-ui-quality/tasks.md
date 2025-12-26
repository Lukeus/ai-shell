# UI Quality Follow-ups Tasks

## Task 1 - Refactor primary sidebar routing
**Effort**: 2-4h  
**Files**:
- `apps/electron-shell/src/renderer/components/layout/PrimarySidebarView.tsx` (new)
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx`
- `specs/155-ui-quality/screenshots/task-1-primary-sidebar.png`
**Work**:
- Move view switching logic (Explorer/Search/SCM/etc.) into PrimarySidebarView.
- Keep ExplorerPanel focused on Explorer rendering only.
**Verify**:
- Manual: switch sidebar views and confirm behavior.
**Done =**
- ExplorerPanel no longer handles routing; screenshot captured.

---

## Task 2 - Remove mock diagnostics
**Effort**: 1-2h  
**Files**:
- `apps/electron-shell/src/renderer/components/problems/ProblemsView.tsx`
**Work**:
- Remove MOCK_DIAGNOSTICS and rely only on diagnostics update stream.
- Ensure empty state when no diagnostics are present.
**Verify**:
- Manual: ProblemsView renders empty state with no diagnostics.
**Done =**
- ProblemsView uses only live diagnostics data.

---

## Task 3 - Standardize context hook errors
**Effort**: 1-2h  
**Files**:
- `apps/electron-shell/src/renderer/contexts/TerminalContext.tsx`
- Other context hooks with missing provider checks (as needed)
**Work**:
- Ensure hooks throw informative errors when provider is missing.
**Verify**:
- Manual: verify errors in dev console when hooks are used outside providers.
**Done =**
- Context hooks fail fast with clear provider messages.

---

## Task 4 - Wire terminal lifecycle actions
**Effort**: 1-2h  
**Files**:
- `apps/electron-shell/src/renderer/components/layout/MenuBar.tsx`
- `apps/electron-shell/src/renderer/contexts/TerminalContext.tsx` (if needed)
- `specs/155-ui-quality/screenshots/task-4-terminal-actions.png`
**Work**:
- Connect "Kill Terminal" and "Clear Terminal" menu actions to TerminalContext.
**Verify**:
- Manual: trigger menu actions and confirm behavior.
**Done =**
- Terminal actions work and screenshot captured.

---

## Task 5 - Breadcrumbs directory navigation
**Effort**: 2-4h  
**Files**:
- `apps/electron-shell/src/renderer/components/editor/BreadcrumbsBar.tsx`
- `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`
- `specs/155-ui-quality/screenshots/task-5-breadcrumbs-nav.png`
**Work**:
- Clicking parent folder segments expands/navigates in the file tree.
**Verify**:
- Manual: click breadcrumb folders and confirm expansion.
**Done =**
- Breadcrumbs navigate folders with screenshot.

---

## Task 6 - Extract static inline styles
**Effort**: 1-2h  
**Files**:
- `apps/electron-shell/src/renderer/components/layout/MenuBar.tsx`
- `packages/ui-kit/src/components/StatusBar.tsx`
**Work**:
- Move static inline styles to Tailwind classes where possible.
**Verify**:
- Manual: visual sanity check for MenuBar and StatusBar.
**Done =**
- Static styles moved without regressions.

---

## Task 7 - Standardize transitions
**Effort**: 2-3h  
**Files**:
- Panels/views with switch animations (as identified)
- `specs/155-ui-quality/screenshots/task-7-transitions.png`
**Work**:
- Apply shared transition classes for panel/view switches.
**Verify**:
- Manual: switch views and confirm consistent transitions.
**Done =**
- Transitions are consistent with screenshot.

---

## Task 8 - Settings tab persistence
**Effort**: 2-4h  
**Files**:
- `apps/electron-shell/src/renderer/components/explorer/FileTreeContext.tsx`
- `specs/155-ui-quality/screenshots/task-8-settings-tab.png`
**Work**:
- Add optional persistence of Settings tab open state.
- Scope to a setting or explicit localStorage key.
**Verify**:
- Manual: reopen app and confirm behavior matches setting.
**Done =**
- Settings tab persistence works and screenshot captured.

---

## Task 9 - Improve editor tab widths
**Effort**: 0.5-1h  
**Files**:
- `apps/electron-shell/src/renderer/styles/vscode-tokens.css`
- `specs/155-ui-quality/screenshots/task-9-tab-width.png`
**Work**:
- Increase tab min/max widths to reduce filename truncation while keeping layout stable.
**Verify**:
- Manual: open several files and confirm filenames remain readable.
**Done =**
- Tabs show longer filenames with a screenshot captured.
