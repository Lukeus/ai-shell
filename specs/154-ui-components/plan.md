# ui-kit: Extract Shared Renderer Components

## Assumptions
- ui-kit already depends on @headlessui/react and @heroicons/react.
- Renderer continues to import shared UI from packages/ui-kit.
- Overlay z-index tokens are available via CSS variables (for example, --vscode-z-dropdown).
- No new IPC or api-contracts changes are required for these UI extractions.

## Architecture decisions
1. Wrapper-first extraction
   - Keep renderer logic (data, callbacks, orchestration) in electron-shell.
   - Move UI mechanics (focus traps, keyboard handling, popover plumbing) into ui-kit.

2. Headless UI primitives for behavior
   - Modal uses Dialog.
   - CommandPalette uses Combobox inside a Dialog/Modal shell.
   - Menu uses Menu.
   - Breadcrumbs and Badge are presentational and do not depend on Headless UI.

3. Overlay layering strategy
   - Use existing CSS variables for z-index and shadow.
   - Keep overlay styling consistent with VS Code tokens.

4. Simple, stable APIs
   - ui-kit exposes minimal props required by current renderer usage.
   - Optional render hooks for CommandPalette to avoid over-abstracting.

5. Incremental rollout
   - Replace renderer components one by one to reduce regressions.
   - Keep existing data and command execution logic in electron-shell.

## Interfaces / component APIs
### Modal
- Props: open, onClose, title, description?, children, initialFocus?, size?
- Behavior: focus trap, escape/backdrop close, overlay, panel styling.

### CommandPalette
- Props: open, onClose, items, onSelect, placeholder?, emptyText?,
  getItemLabel?, getItemIcon?, getItemDisabled?, renderItem?, groupBy?, renderGroupHeader?, footer?,
  initialQuery?, queryTransform?, onQueryChange?, closeOnSelect?
- Behavior: type to filter (strip leading `>` by default), grouped sections optional,
  arrow navigation, enter select, escape close.

### Menu
- Props: trigger, items (label, onClick, disabled?, icon?, shortcut?, type?: item|separator)
- Behavior: keyboard navigation, focus management, close on select/escape.

### Badge
- Props: label, variant (default|success|warning|danger|info|muted|blue|indigo|purple|pink), onClick?

### Breadcrumbs
- Props: items: { label, onClick?, href?, current?, icon? }[]
- Behavior: truncation/overflow handling, accessible separators, aria-current for current item, optional leading icon per item.

## Data model changes
- None.

## Migrations
1. Add ui-kit components (Modal, CommandPalette, Menu, Badge, Breadcrumbs) + exports.
2. Update renderer:
   - ConfirmDeleteModal -> ui-kit Modal (optional ConfirmDialog wrapper in renderer).
   - CommandPalette UI -> ui-kit CommandPalette (keep command list + execution in app).
   - Menu usage -> ui-kit Menu where applicable.
   - SddBadge + BreadcrumbsBar -> ui-kit Badge and Breadcrumbs.
3. Remove deprecated renderer UI components after replacements land.

## Test strategy
- ui-kit unit tests for each new component:
  - Modal: open/close, focus behavior, escape/backdrop close.
  - CommandPalette: dialog open/close, listbox roles, keyboard selection, empty state.
  - Menu: roles, disabled items, keyboard selection.
  - Badge/Breadcrumbs: rendering and click handling.
- Renderer smoke checks for command palette, confirm delete, and editor breadcrumbs.

## Rollout plan
- Phase 1: Modal and Badge/Breadcrumbs.
- Phase 2: CommandPalette.
- Phase 3: Menu (context menus first, then MenuBar if applicable).

## Observability
- Optional: if telemetry exists, log open/select events; otherwise skip.

## Security checklist
- No Node or Electron APIs in ui-kit components.
- No secrets or IPC changes introduced.
- No dynamic code execution.
