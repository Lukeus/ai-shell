#  Extract Shared Renderer Components fro electron-shell into ui-kit (CommandPalette, Modal, Menu, Badge, Breadcrumbs)

## Goals
- Reduce renderer (electron-shell) complexity by extracting reusable UI components into `packages/ui-kit`.
- Standardize accessibility and behavior by implementing extracted components using `@headlessui/react`.
- Standardize visual language (icons, spacing, focus, overlays) across the app using `@heroicons/react` where appropriate.
- Leave app-side code focused on orchestration/business logic (command execution, indexing, routing), not focus traps and keyboard plumbing.
- Align editor tabs and breadcrumbs styling with VS Code (spacing, separators, and truncation).

## Non-goals
- Rewriting command indexing/search algorithms (keep in app).
- Implementing a full VS Code extension menu system or keybinding engine.
- Replacing every existing modal/menu everywhere in one pass (incremental rollout).
- Building a full design token system.

## Dependencies / Prerequisites
- `@headlessui/react` + `@heroicons/react` installed in ui-kit (from the migration feature).
- A shared z-index/overlay strategy for dropdowns and modals.
- A basic Icon strategy (either direct Heroicons usage or ui-kit `Icon` mapping).

## Personas
- **IDE User**: expects keyboard-first workflows and predictable overlays.
- **A11y User**: expects correct roles, labeling, and focus management.
- **App Maintainer**: wants fewer bespoke implementations duplicated per modal/menu.

## User stories
1. As a user, I can open the command palette and search commands with keyboard only.
2. As a user, modals trap focus correctly and close via Escape/backdrop click.
3. As a maintainer, I can create a modal with one component rather than copy/paste portal + listeners.
4. As a maintainer, app-side CommandPalette code is mostly “data + callbacks”, not UI mechanics.
5. As a user, breadcrumbs and badges look consistent across screens.

## Acceptance criteria

### Modal / Dialog (ui-kit)
- A generic `Modal` component wraps Headless UI `Dialog`.
- Supports: `open`, `onClose`, `title`, `description?`, `children`, `initialFocus?`, `size?`.
- Includes standardized overlay, panel styling, z-index, and enter/exit animation (if you already use transitions).
- Closes on Escape and backdrop click (Headless UI default), without app-side listeners.
- Focus is trapped while open and restored on close.

### CommandPalette (ui-kit)
- A generic `CommandPalette` component built on Headless UI `Combobox`.
- Palette renders inside a dialog-style overlay (Headless UI `Dialog` or ui-kit `Modal`) with backdrop + panel styling.
- ui-kit manages:
  - focus, open/close, keyboard navigation, selection
  - filtering UI scaffolding (input, list, empty state)
- app provides:
  - `items` (commands)
  - `onSelect(item)` callback
  - optional `getItemLabel`, `getItemIcon`, `renderItem` hooks
-  optional `getItemDisabled` hook (disabled items are not selectable)
- optional `onQueryChange` hook (host can react to query/mode changes)
- optional `closeOnSelect` toggle (host can manage close timing on async actions)
- Supports:
  - type-to-filter
  - Arrow navigation
  - Enter to select
  - Esc to close
  - optional grouped sections with headings
  - optional footer slot (hints / modifiers)
  - `>` prefix support for command-mode (input can default to `>`; prefix is ignored for filtering)
- Accessibility: proper roles for combobox/listbox/options and labeling.

### Menu (ui-kit)
- A `Menu` component built on Headless UI `Menu`.
- Supports trigger button, items, disabled items, separators, optional icons.
- Correct keyboard and focus behavior without app-side plumbing.

### Badge + Breadcrumbs (ui-kit)
- `Badge` component supports variants: `default | success | warning | danger | info | muted | blue | indigo | purple | pink`.
- `Breadcrumbs` supports an array of `{ label, onClick? , href?, current?, icon? }`, truncation/overflow handling, and accessible separators.
- Breadcrumbs should set `aria-current="page"` when `current` is true and render an optional leading icon per item.
- Tabs and breadcrumbs match VS Code visual density (height, padding, separator size).

### App-side replacement
- electron-shell renderer replaces:
  - `ConfirmDeleteModal` → ui-kit `Modal` (and optional `ConfirmDialog` wrapper)
  - `CommandPalette.tsx` UI → ui-kit `CommandPalette` (app keeps command list + execution)
  - Menu components (if present) → ui-kit `Menu`
  - `SddBadge`, `BreadcrumbsBar` → ui-kit equivalents
- No behavioral regressions in core flows (open/close, keyboard nav, execute command, confirm delete).

## UX flow
- Command palette:
  - open → dialog overlay → input focused (defaults to `>`) → list filters as you type → select → execute → close
- Modal:
  - open → focus trapped → confirm/cancel → close restores focus
- Menu:
  - open via click/keyboard → arrow through items → enter activates → esc closes

## Edge cases
- Overlay stacking in IDE layout (panels, titlebars, resizable panes).
- Large command lists: performance (virtualization optional, not required initially).
- Nested overlays: menu inside modal / palette inside modal (define “one overlay at a time” rule).
- Commands with duplicate labels: stable IDs.

## Telemetry (optional)
- `ui.commandPalette.open`, `ui.commandPalette.select`
- `ui.modal.open`, `ui.modal.confirm`, `ui.modal.cancel`
- No PII.

## Risks
- Overlay layering bugs (z-index wars).
- Inconsistent animation patterns between existing UI and new components.
- Over-abstracting CommandPalette too early; mitigate by keeping API simple and matching current usage first.

