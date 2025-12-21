# VS Code UI/UX Alignment

## Problem / Why
The current UI feels close to VS Code but not quite there, which reduces familiarity and
slows navigation. We need to tighten the visual system and interaction details so the
shell reads and behaves like a VS Code class desktop IDE.

## Goals
- Match VS Code like visual hierarchy and chrome for core regions (activity bar, sidebars,
  editor tabs, bottom panel, status bar).
- Align spacing, sizing, and typography to a consistent system defined by Tailwind 4 tokens.
- Preserve existing layout structure and behaviors while improving fit and finish.
- Make the UI feel immediately familiar to VS Code users.

## Non-goals
- No new layout regions or major feature additions.
- No change to process boundaries or security model.
- No UI library migration or global CSS rewrite.
- No changes to extension or agent functionality beyond visuals.

## User stories
- As a developer, I can orient myself instantly because the layout, chrome, and controls
  resemble VS Code.
- As a user, I can distinguish active vs inactive panels and tabs at a glance.
- As a user, I can resize and toggle panels and the UI preserves those choices.

## UX requirements
- The six regions remain in place with VS Code like sizing boundaries:
  - Activity bar fixed width 48px.
  - Primary sidebar resizable 200-600px.
  - Secondary sidebar resizable 200-600px.
  - Bottom panel resizable 100-600px.
  - Status bar fixed height 24px.
- Activity bar icons align to a consistent grid and show active/hover states that are
  visually distinct but subtle.
- Panel headers (Explorer, Search, etc.) use consistent height, padding, and typography.
- Editor tabs show file icon, filename, close affordance, and active tab emphasis.
- Breadcrumbs and tab bar spacing align to VS Code style (no cramped or oversized gaps).
- Colors and spacing are driven by Tailwind 4 token variables only.
- Menu bar matches VS Code styling (height, padding, hover/active states) and shows
  a left-aligned app icon placeholder.
- Window controls (minimize, maximize/restore, close) render on Windows/Linux and
  match VS Code placement on the top-right.
- Menu bar row is draggable on Windows/Linux except for interactive elements.

## Functional requirements
- Panel toggle shortcuts remain unchanged.
- Panel sizes and collapsed state persist across restart.
- Active panel and active tab are clearly indicated with color and weight changes.
- Tree view indentation and row height are consistent across folders and files.
- Native menu bar is hidden on Windows/Linux so only the custom menu bar is visible.
- Window control actions are routed through IPC with no direct Electron access
  in the renderer.

## Security requirements
- No change to renderer sandboxing, contextBridge usage, or IPC boundaries.
- No arbitrary CSS injection from extensions; only approved token overrides.

## Performance requirements
- Monaco remains lazy-loaded and absent from the initial renderer bundle.
- UI changes must not add large new runtime dependencies.
- No new synchronous blocking work on initial render.

## Acceptance criteria
- Screenshots of activity bar, sidebars, editor tabs, bottom panel, and status bar
  show a consistent VS Code like chrome and spacing.
- Menu bar looks consistent with VS Code and does not double-render with native menus.
- Window controls appear only on Windows/Linux, and buttons behave correctly.
- All region sizes and constraints match the defined pixel bounds.
- Active vs inactive states are visually distinct without reducing contrast.
- No regressions in panel toggles, persistence, or shortcuts.
- No increase in initial renderer bundle size attributable to this work.

## Out of scope / Future work
- Theme variants beyond the current token system.
- New layout behaviors (split editors, tab groups, etc.).
- Extension marketplace or agent runtime changes.

## Open questions
- Which VS Code theme should we use as the visual baseline (Default Dark, Light, or other)?
- Are there any specific VS Code UI elements we should prioritize for 1:1 alignment?
