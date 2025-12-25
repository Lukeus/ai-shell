# ui-kit: Extract Shared Renderer Components Tasks

## Task 1 - Add Modal component (ui-kit)
**Effort**: 2-4h
**Files**:
- `packages/ui-kit/src/components/Modal.tsx`
- `packages/ui-kit/src/components/__tests__/Modal.test.tsx`
- `packages/ui-kit/src/index.ts`
- `specs/154-ui-components/screenshots/task-1-modal.png`
**Work**:
- Implement a Modal wrapper around Headless UI Dialog.
- Apply VS Code token styling and overlay z-index.
- Support open, onClose, title, description?, children, initialFocus?, size?.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- No Node or Electron APIs.
**Done =**
- Modal renders, traps focus, closes on escape/backdrop, and has a screenshot.

---

## Task 2 - Add CommandPalette component (ui-kit)
**Effort**: 3-6h
**Files**:
- `packages/ui-kit/src/components/CommandPalette.tsx`
- `packages/ui-kit/src/components/__tests__/CommandPalette.test.tsx`
- `packages/ui-kit/src/index.ts`
- `specs/154-ui-components/screenshots/task-2-command-palette.png`
**Work**:
- Implement a Dialog + Combobox-based CommandPalette UI shell with backdrop + panel styling.
- Accept items and onSelect, with optional label/icon/render helpers.
- Provide empty state, grouped sections (optional), and a footer slot for hints/modifiers.
- Include a leading search icon and focus-first input.
- Support default `>` query prefix and strip it from filtering (or via a queryTransform hook).
- Support disabled items via a getItemDisabled hook.
- Allow the host to observe query changes and control close-on-select behavior.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- No command execution logic in ui-kit.
**Done =**
- Palette opens in an overlay, filters, groups items, navigates via keyboard, and has a screenshot.

---

## Task 3 - Add Menu component (ui-kit)
**Effort**: 2-4h
**Files**:
- `packages/ui-kit/src/components/Menu.tsx`
- `packages/ui-kit/src/components/__tests__/Menu.test.tsx`
- `packages/ui-kit/src/index.ts`
- `specs/154-ui-components/screenshots/task-3-menu.png`
**Work**:
- Implement Menu using Headless UI Menu.
- Support items, disabled state, separators, icons, and shortcuts.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- Keyboard and focus behavior handled by Headless UI.
**Done =**
- Menu supports keyboard selection and has a screenshot.

---

## Task 4 - Add Badge and Breadcrumbs (ui-kit)
**Effort**: 2-4h
**Files**:
- `packages/ui-kit/src/components/Badge.tsx`
- `packages/ui-kit/src/components/Breadcrumbs.tsx`
- `packages/ui-kit/src/components/__tests__/Badge.test.tsx`
- `packages/ui-kit/src/components/__tests__/Breadcrumbs.test.tsx`
- `packages/ui-kit/src/index.ts`
- `specs/154-ui-components/screenshots/task-4-badge-breadcrumbs.png`
**Work**:
- Implement Badge variants and optional click handling.
- Implement Breadcrumbs with truncation, accessible separators, current item support, and optional leading icons.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- Styling uses existing CSS variables/tokens.
**Done =**
- Badge and Breadcrumbs render correctly with a screenshot.

---

## Task 5 - Replace ConfirmDeleteModal with ui-kit Modal
**Effort**: 2-4h
**Files**:
- `apps/electron-shell/src/renderer/components/explorer/ConfirmDeleteModal.tsx`
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx`
- `specs/154-ui-components/screenshots/task-5-confirm-delete.png`
**Work**:
- Replace custom modal plumbing with ui-kit Modal.
- Keep confirm/cancel logic in renderer.
**Verify**:
- Manual: open confirm delete and verify focus/escape/backdrop.
**Invariants**:
- No change to delete behavior.
**Done =**
- Confirm delete uses ui-kit Modal and has a screenshot.

---

## Task 6 - Replace CommandPalette UI with ui-kit CommandPalette
**Effort**: 3-6h
**Files**:
- `apps/electron-shell/src/renderer/components/command-palette/CommandPalette.tsx`
- `apps/electron-shell/src/renderer/App.tsx`
- `specs/154-ui-components/screenshots/task-6-command-palette.png`
**Work**:
- Move UI to ui-kit CommandPalette.
- Keep command list and execution logic in renderer.
 - Preserve `>` command-mode behavior (default prefix + filtering).
**Verify**:
- Manual: open palette, filter, select, escape close.
**Invariants**:
- No changes to command execution.
**Done =**
- Command palette uses ui-kit component and has a screenshot.

---

## Task 7 - Replace badges and breadcrumbs with ui-kit components
**Effort**: 2-4h
**Files**:
- `apps/electron-shell/src/renderer/components/sdd/SddBadge.tsx`
- `apps/electron-shell/src/renderer/components/editor/BreadcrumbsBar.tsx`
- `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`
- `specs/154-ui-components/screenshots/task-7-badges-breadcrumbs.png`
**Work**:
- Replace SddBadge with ui-kit Badge usage.
- Replace BreadcrumbsBar with ui-kit Breadcrumbs.
**Verify**:
- Manual: check badges and breadcrumbs in editor.
**Invariants**:
- Keep existing click behavior.
**Done =**
- Badge and Breadcrumbs are sourced from ui-kit with screenshot.

---

## Task 8 - Replace renderer menus with ui-kit Menu
**Effort**: 3-6h
**Files**:
- `apps/electron-shell/src/renderer/components/editor/EditorTabBar.tsx`
- `apps/electron-shell/src/renderer/components/layout/MenuBar.tsx` (if applicable)
- `specs/154-ui-components/screenshots/task-8-menus.png`
**Work**:
- Replace context menu UI with ui-kit Menu component.
- Evaluate MenuBar integration; migrate if practical without regression.
**Verify**:
- Manual: open menus, keyboard navigate, select items.
**Invariants**:
- No change to menu action handlers.
**Done =**
- Menus use ui-kit Menu and have a screenshot.

---

## Task 9 - Cleanup + test pass
**Effort**: 1-3h
**Files**:
- Any removed renderer components or exports
- `specs/154-ui-components/tasks.md`
**Work**:
- Remove dead UI code paths after migration.
- Ensure ui-kit exports remain stable.
**Verify**:
- `pnpm --filter packages-ui-kit test`
- Optional: `pnpm test`
**Invariants**:
- No unrelated refactors.
**Done =**
- Dead code removed and tests pass.
