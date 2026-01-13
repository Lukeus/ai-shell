# 162 - Theme Integration Hardening - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P4, P5, P6, P7).

## Architecture changes
- Normalize Tailwind token names via CSS variable aliases in renderer styles.
- Migrate ui-kit chrome components to semantic `--color-*` tokens for color usage.
- Add Tailwind `@source` entries so renderer builds include ui-kit classes.
- Move menu event subscriptions into `window.api` (contracts-first).
- Enforce terminal env allowlist for PTY sessions in main process (no extra vars).
- Remove static Monaco import; retain dynamic import only.

## Contracts (api-contracts updates)
- Extend `PreloadAPI` with a menu events surface (subscribe/unsubscribe).
- Export any new types from `packages/api-contracts/src/index.ts`.
- Use existing `IPC_CHANNELS.MENU_*` constants (no new channels needed).

## IPC + process boundaries
- Renderer listens to menu events via `window.api` only.
- Preload remains the only place that accesses `ipcRenderer`.
- Main continues to send menu events using existing channels.

## UI components and styles
- Add semantic text color aliases in `globals.css` to align with `text-primary/secondary/tertiary`.
- Update ui-kit components to use semantic tokens for chrome colors.
- Add Tailwind `@source` entries to include `packages/ui-kit` classes.
- No component redesigns; only token and theme mapping changes.

## Data model changes
- None.

## Failure modes + recovery
- Missing Tailwind `@source` can drop ui-kit classes: verify in build output.
- Incomplete ui-kit migration can leave components tied to `--vscode-*` colors: validate by theme switching and computed styles.
- Terminal env allowlist too strict could break shells: allowlist should include PATH, HOME, and platform basics.

## Testing strategy
- Unit: terminal env allowlist behavior in `TerminalService`.
- UI tests: settings-theming or component tests to confirm token aliases are applied.
- Build sanity: renderer build or bundle check to confirm Monaco remains lazy-loaded.
- Manual: validate high-contrast and system themes; capture screenshot.

## Rollout / migration
- Backward compatible: aliases and theme overrides do not change stored settings.
- Menu event API change is internal to renderer/preload only.

## Risks + mitigations
- Risk: remaining `--vscode-*` usage is unintentional. Mitigation: limit `--vscode-*` to non-ui kit needs and add targeted overrides if needed.
- Risk: incomplete ui-kit migration leaves mixed token usage. Mitigation: search ui-kit for `--vscode-` usage and update.
- Risk: terminal env allowlist breaks user workflows. Mitigation: allowlist includes common shell variables and document behavior.
- Risk: Monaco import change affects types. Mitigation: use `import type` and keep runtime imports dynamic.

## Done definition
- Token aliases added and verified across themes.
- High-contrast/system theme overrides applied to chrome elements.
- Tailwind sources include ui-kit classes.
- Monaco is not statically imported in renderer.
- Menu events are in `window.api` with contracts-first types.
- Terminal env allowlist enforced and tested.
- Screenshot captured for theme changes.
