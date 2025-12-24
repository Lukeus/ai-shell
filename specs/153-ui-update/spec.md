# ui-kit: Migrate to Headless UI + Heroicons

## Goals
- Adopt `@headlessui/react` for interactive primitives to reduce custom a11y/keyboard logic and maintenance burden.
- Adopt `@heroicons/react` for a consistent, tree-shakeable icon set (starting with ActivityBar and common toggles).
- Preserve VS Code/IDE visual language (spacing, focus rings, hover/active states, contrast) while improving accessibility.
- Minimize downstream churn by keeping existing ui-kit public component APIs stable where feasible.

## Non-goals
- Full design system overhaul or theming rewrite.
- Replacing *all* codicons across the entire app in one pass.
- Introducing new global state management or routing changes.
- Implementing complex “typeahead search” selects unless already required by consumers.

## Personas
- **IDE User (Developer)**: Navigates via keyboard, expects VS Code-like behavior, uses tabs, sidebars, panels.
- **Accessibility User**: Relies on screen readers and predictable focus behavior.
- **ui-kit Maintainer**: Wants fewer bespoke keyboard handlers and fewer regression-prone components.

## User stories
1. As a keyboard user, I can move between tabs using standard keys (Arrow, Home/End) with clear focus indication.
2. As a screen reader user, switches/tabs/disclosures announce correct roles/states.
3. As a developer, I can drop in icons without codicon CSS dependencies.
4. As a maintainer, I can remove custom keydown/ARIA logic and rely on Headless UI semantics.

## Acceptance criteria
### Dependency + bundling
- `@headlessui/react` and `@heroicons/react` are added to `packages/ui-kit`.
- Build outputs remain compatible with the Electron renderer (ESM/CJS as currently configured).
- No new runtime dependencies added to the sandboxed renderer beyond React-level UI libs.

### ToggleSwitch → Headless UI Switch
- Existing `ToggleSwitch` props remain compatible (or a documented, minimal breaking change).
- Switch supports: click, Space/Enter, disabled state, focus ring, correct `aria-checked`.
- Visual states match current theme tokens.

### PanelHeader → Headless UI Disclosure
- Existing expand/collapse behavior preserved (mouse + keyboard).
- Chevron icon reflects open/closed state (Heroicons).
- No duplicate interactive elements (no button-in-button nesting).

### TabBar → Headless UI Tabs
- Keyboard navigation logic is removed from ui-kit implementation (delegate to Headless UI).
- Tabs support Arrow keys + Home/End and maintain correct `aria-selected` semantics.
- Active tab styling matches current (selected, hover, focus-visible, disabled if applicable).

### Select → Headless UI Listbox (cautious)
- Provide a Listbox-based select **without forcing all consumers to change**:
  - Either `Select` gains `variant="native" | "listbox"` (default stays `native`), OR a new `SelectListbox` is introduced.
- Listbox dropdown:
  - Correct layering (z-index) in an IDE layout with panels/overlays.
  - Handles long option lists with scroll, keeps selection visible.
  - Supports keyboard: Up/Down, Enter, Esc, type-to-jump (Headless UI default behavior).

### ActivityBar → Headless UI Tabs (vertical) + Heroicons
- Replace codicon CSS usage in `ActivityBar` with Heroicons for at least the current set of icons used there.
- Vertical tabs behave correctly via keyboard and announce states.

### Tests
- Unit tests updated/added for migrated components:
  - Roles/states (Switch/Tab/Disclosure/Listbox)
  - Keyboard interactions for at least one “happy path” per component
- No regressions in existing ui-kit test suite.

## UX flow
- **Switch**: Focus → Space toggles → state announced.
- **Tabs**: Focus tablist → Arrow keys move selection → active panel updates.
- **Disclosure**: Focus header → Enter toggles → content expands/collapses.
- **Listbox**: Focus button → Enter opens → Arrow selects → Enter commits → Esc closes.

## Edge cases
- Disabled controls: no interaction, correct aria disabled semantics.
- Nested focus traps / resizable panels: dropdown/tab focus doesn’t get lost.
- Long labels / overflow: truncation doesn’t hide focus ring.
- High contrast themes: icons remain visible.
- “Click outside to close” doesn’t fight Electron window focus changes.

## Telemetry (optional, minimal)
- No PII. Only coarse UI events if telemetry exists already:
  - `ui.select.open`, `ui.select.choose`, `ui.activitybar.switch`, `ui.tabbar.switch`
- If telemetry is not established, skip (do not introduce a new telemetry pipeline for this migration).

## Risks
- **Visual drift**: Headless UI defaults differ; mitigated via wrapper components + theme tokens.
- **Dropdown layering**: IDE z-index stacks are tricky; mitigate with a standard “overlay layer token” and regression tests.
- **Icon consistency**: partial migration could look mixed; mitigate via an Icon abstraction or a scoped migration in ActivityBar first.
- **Breaking API changes**: mitigated by wrapper approach and incremental rollout.




