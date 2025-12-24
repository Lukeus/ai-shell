
# ui-kit: Headless UI + Heroicons Migration Plan

## Assumptions
- Repo structure includes `packages/ui-kit` with React 18 + Tailwind 4.
- ui-kit uses a unit test runner (Vitest/Jest) and React Testing Library (or equivalent).
- ActivityBar currently depends on codicon CSS classes; codicon CSS is available app-wide today.

## Architecture decisions
1. **Wrapper-first approach**
   - Keep ui-kit components as the public API.
   - Internals swap to Headless UI primitives (Switch/Tabs/Disclosure/Listbox).
   - This reduces downstream churn and allows incremental adoption.

2. **Icon abstraction for incremental migration**
   - Introduce a lightweight `Icon` mapping layer for ActivityBar (and later others):
     - `Icon name="explorer" | "search" | ...` → renders Heroicon component.
   - Avoid forcing a “big bang” codicon removal.

3. **Select strategy: additive, not breaking**
   - Implement Listbox support without removing native `<select>` immediately.
   - Recommended: `Select` supports `variant="native" | "listbox"` with default `"native"`.
   - Consumers opt in to `"listbox"` where custom styling is needed.

4. **Consistent overlay layering**
   - Define a single Tailwind z-index token/class for popovers/dropdowns (e.g. `z-[60]` or a theme constant).
   - Ensure Listbox options container uses this token consistently.

## Interfaces / contracts
### ToggleSwitch (unchanged or minimal change)
- Keep: `checked`, `onChange`, `disabled`, `label?`, `className?` (whatever exists today)
- Internals: Headless UI `Switch`

### TabBar
- Preserve existing props:
  - `tabs: { id: string; label: string; icon?: ... }[]`
  - `activeTabId`, `onChange(tabId)`
- Internals: Headless UI `Tab.Group`
  - Map `activeTabId` ↔ Headless UI `selectedIndex`

### PanelHeader
- Preserve: `title`, `isOpen`, `onToggle` if currently controlled
- Internals:
  - Option A (preferred): keep it controlled, use `Disclosure` with `open` derived (Headless UI is primarily uncontrolled; controlled requires care)
  - Option B: convert to uncontrolled but preserve outward behavior via callbacks (document if breaking)

### Select
- Keep existing native API.
- Add:
  - `variant?: "native" | "listbox"` (default `"native"`)
  - When `variant="listbox"`, accept options of `{ value, label, disabled? }` (or adapt current options shape)

### ActivityBar
- Maintain existing action IDs and selection behavior.
- Replace codicon classes with `Icon` mapping:
  - `Icon` uses Heroicons internally.

## Data model changes
- None.

## Migrations
1. Add dependencies to ui-kit:
   - `@headlessui/react`
   - `@heroicons/react`
2. Add `Icon` abstraction and map ActivityBar icons.
3. Migrate low-risk components first (ToggleSwitch, PanelHeader).
4. Migrate ActivityBar next (icons + vertical tabs).
5. Migrate TabBar (largest keyboard-logic removal).
6. Add optional Listbox select.
7. Remove dead code paths and document any changes.

## Test strategy
- **Unit tests** (ui-kit):
  - Switch toggles via keyboard and updates aria state
  - Tabs switch via Arrow keys and update selected panel
  - Disclosure toggles and content visibility changes
  - Listbox opens/closes, selection commits, Esc closes
- **A11y assertions**:
  - Prefer role-based queries: `getByRole('switch')`, `getByRole('tab')`, `getByRole('listbox')`
- **Visual sanity**:
  - If Storybook exists: add/verify stories for each migrated component.
  - If screenshot testing exists: update snapshots minimally.

## Rollout plan
- Phase 1 (safe): dependencies + ToggleSwitch + PanelHeader + Icon abstraction
- Phase 2 (medium): ActivityBar migration
- Phase 3 (larger): TabBar migration
- Phase 4 (optional): Select Listbox variant
- Phase 5: codicon reduction sweep (separate feature)

## Observability
- If an existing telemetry layer exists, add minimal events (spec section).
- Otherwise, rely on test coverage + manual QA checklist:
  - Keyboard navigation
  - Focus ring visibility
  - Dropdown layering inside panels

## Security checklist
- No Node/Electron APIs used in ui-kit.
- No dynamic code loading.
- Dependencies are UI-only libraries (no filesystem/network).
- Ensure no unsafe HTML injection (no `dangerouslySetInnerHTML` added).
- Keep all interactive behavior within sandbox-safe React components.

