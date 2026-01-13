# 162 - Theme Integration Hardening

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P4, P5, P6, P7).

## Problem / Why
- Theme tokens do not align with UI kit class usage, which risks inconsistent text colors across themes.
- High-contrast and system themes do not fully reach components still using `--vscode-*` tokens.
- Tailwind class extraction may skip `packages/ui-kit`, causing missing classes in production builds.
- Monaco is statically imported in the renderer, risking initial bundle bloat and P5 violations.
- Menu event IPC is exposed via `window.electron`, outside contracts-first `window.api`.
- Terminal env sanitization is documented but not enforced in code.

## Goals
- Align Tailwind token names with UI kit usage without redesigning the UI.
- Ensure all themes (dark/light/system/high-contrast) affect chrome and menus consistently.
- Ensure Tailwind generates classes used by ui-kit in the renderer build.
- Preserve Monaco lazy-loading (no static import in renderer).
- Move menu event subscriptions into contracts-first `window.api`.
- Enforce a terminal env allowlist aligned with security docs (no extra vars).

## Decisions
- Migrate ui-kit components to semantic `--color-*` tokens rather than mapping all `--vscode-*` tokens for every theme.
- Terminal sessions use only the existing child-process allowlist (no additional env vars).

## Non-goals
- No new theme designs or global UI redesigns.
- No UI library migration.
- No changes to extension/agent APIs beyond menu events.
- No new terminal features beyond env handling.

## User stories
1. As a user, I see consistent text and chrome colors across all themes.
2. As a user, high-contrast and system themes are applied to status bar, menus, and panels.
3. As a developer, Tailwind builds include ui-kit classes reliably.
4. As a developer, Monaco stays out of the initial renderer chunk.
5. As a developer, menu events are typed and exposed via `window.api`.
6. As a security reviewer, terminal env handling is explicit and enforced.

## UX requirements
- Theme switching should not leave mismatched chrome colors.
- High-contrast themes must preserve legible foreground/background pairs.
- Theme updates must use CSS variables (no raw hex in components).
- UI-visible changes must include a screenshot.

## Functional requirements
- Add Tailwind token aliases for `text-primary`, `text-secondary`, and `text-tertiary` usage.
- Migrate ui-kit components to semantic `--color-*` tokens for chrome colors; keep any remaining `--vscode-*` usage intentional.
- Add Tailwind `@source` entries so ui-kit classes are included in renderer builds.
- Replace static Monaco import with type-only import and keep dynamic loading.
- Expose menu event subscriptions through `PreloadAPI` and remove `window.electron` usage.
- Implement terminal env allowlist consistent with documented security posture.

## Security requirements
- Renderer remains sandboxed; no direct Electron or Node access.
- Contracts-first updates for menu events.
- No secret logging; terminal env allowlist enforced.

## Performance requirements
- Monaco remains lazy-loaded; initial renderer bundle excludes monaco-editor.
- Theme switching remains within existing performance budgets.

## Acceptance criteria
- UI kit text colors map correctly in all themes.
- High-contrast and system themes affect status bar, menus, and panels.
- Tailwind build includes ui-kit classes without manual hacks in components.
- Monaco is no longer statically imported in the renderer.
- Menu events use `window.api` and are defined in api-contracts.
- Terminal env allowlist is implemented and tested.
- Screenshot added for UI-visible theme changes.

## Out of scope / Future work
- New theme presets or UI redesigns.
- Additional IPC APIs unrelated to menu events.
- Terminal features beyond env handling.
