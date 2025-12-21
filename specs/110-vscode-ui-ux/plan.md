# VS Code UI/UX Alignment - Technical Plan

## Architecture changes
- Use custom title bar on Windows/Linux to render window controls in the menu bar.
- No changes to process boundaries or overall layout architecture.
- UI updates are limited to renderer and ui-kit components.

## Contracts (api-contracts updates)
- Add IPC channels for window control actions (minimize, maximize/restore, close).

## IPC + process boundaries
- Add IPC handlers for window control actions.
- Maintain current renderer sandboxing and contextBridge access patterns.

## UI components and routes
- Update ui-kit chrome components to match VS Code like spacing and styling:
  - `packages/ui-kit/src/components/ActivityBar.tsx`
  - `packages/ui-kit/src/components/PanelHeader.tsx`
  - `packages/ui-kit/src/components/StatusBar.tsx`
  - `packages/ui-kit/src/components/TabBar.tsx`
  - `packages/ui-kit/src/components/ShellLayout.tsx`
  - `packages/ui-kit/src/components/ResizablePanel.tsx`
- Update renderer layout components to align with the chrome updates:
  - `apps/electron-shell/src/renderer/components/editor/EditorTabBar.tsx`
  - `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`
  - `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx`
  - `apps/electron-shell/src/renderer/components/layout/SecondarySidebar.tsx`
  - `apps/electron-shell/src/renderer/components/explorer/FileTree.tsx`
  - `apps/electron-shell/src/renderer/components/explorer/FileTreeNode.tsx`
- Update menu bar chrome to match VS Code styling and hide native menu on Windows/Linux:
  - `apps/electron-shell/src/renderer/components/layout/MenuBar.tsx`
  - `apps/electron-shell/src/main/index.ts`
- Add window controls (minimize, maximize/restore, close) on Windows/Linux:
  - `packages/api-contracts/src/ipc-channels.ts`
  - `packages/api-contracts/src/preload-api.ts`
  - `apps/electron-shell/src/preload/index.ts`
  - `apps/electron-shell/src/main/ipc-handlers.ts`
  - `apps/electron-shell/src/renderer/components/layout/MenuBar.tsx`
  - `apps/electron-shell/src/main/index.ts` (custom title bar on Windows/Linux)
- Use Tailwind 4 token variables from:
  - `apps/electron-shell/src/renderer/styles/vscode-tokens.css`
  - `apps/electron-shell/src/renderer/styles/themes.css`
  - `apps/electron-shell/src/renderer/styles/globals.css`

## Data model changes
- None.

## Failure modes + recovery
- Token regressions: Missing or invalid token values degrade layout or contrast.
  - Mitigation: keep fallbacks in CSS variables and verify contrast manually.
- Visual regressions in layout chrome due to spacing updates.
  - Mitigation: before/after screenshots and quick UI smoke check.

## Testing strategy
- Update unit tests for ui-kit components if snapshots or expectations change.
- Update renderer component tests where classnames or structure change.
- Manual UI verification in dev build with screenshot capture.

## Rollout / migration
- No migration. Ship as standard UI refinement.

## Risks + mitigations
- Risk: VS Code alignment is subjective and drifts without a baseline.
  - Mitigation: pick a single VS Code theme baseline and compare screenshots.
- Risk: Token changes affect multiple components unexpectedly.
  - Mitigation: update ui-kit components first, then renderer components.

## Done definition
- Spec acceptance criteria met.
- UI chrome matches VS Code like alignment in screenshots.
- All relevant tests updated and passing.
- No new dependencies and no violations of WARP rules.
