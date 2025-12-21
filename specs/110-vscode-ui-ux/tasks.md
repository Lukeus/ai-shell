# VS Code UI/UX Alignment - Tasks
## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Define VS Code baseline tokens
Files:
- apps/electron-shell/src/renderer/styles/vscode-tokens.css
- apps/electron-shell/src/renderer/styles/themes.css
- apps/electron-shell/src/renderer/styles/globals.css
Verification:
- pnpm --filter apps/electron-shell lint
Invariants:
- Tailwind 4 tokens only, no hardcoded theme overrides
- No new dependencies

## Task 2 - Align ui-kit chrome components
Files:
- packages/ui-kit/src/components/ActivityBar.tsx
- packages/ui-kit/src/components/PanelHeader.tsx
- packages/ui-kit/src/components/StatusBar.tsx
- packages/ui-kit/src/components/TabBar.tsx
- packages/ui-kit/src/components/ShellLayout.tsx
- packages/ui-kit/src/components/ResizablePanel.tsx
Verification:
- pnpm --filter packages/ui-kit test
Invariants:
- Activity bar width 48px, status bar height 24px
- Use token variables for spacing, colors, borders

## Task 3 - Align renderer layout components
Files:
- apps/electron-shell/src/renderer/components/editor/EditorTabBar.tsx
- apps/electron-shell/src/renderer/components/editor/EditorArea.tsx
- apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx
- apps/electron-shell/src/renderer/components/layout/SecondarySidebar.tsx
- apps/electron-shell/src/renderer/components/explorer/FileTree.tsx
- apps/electron-shell/src/renderer/components/explorer/FileTreeNode.tsx
Verification:
- pnpm --filter apps/electron-shell test
Invariants:
- No process boundary changes
- No new IPC or contextBridge additions

## Task 4 - Align menu bar chrome with VS Code
Files:
- apps/electron-shell/src/renderer/components/layout/MenuBar.tsx
- apps/electron-shell/src/main/index.ts
Verification:
- pnpm --filter apps/electron-shell test
Invariants:
- No new IPC or contextBridge additions
- Native menu bar hidden on Windows/Linux

## Task 5 - Add window controls (Windows/Linux)
Files:
- packages/api-contracts/src/ipc-channels.ts
- packages/api-contracts/src/preload-api.ts
- apps/electron-shell/src/preload/index.ts
- apps/electron-shell/src/main/ipc-handlers.ts
- apps/electron-shell/src/renderer/components/layout/MenuBar.tsx
Verification:
- pnpm --filter apps/electron-shell test
Invariants:
- Renderer uses contextBridge only
- Controls hidden on macOS

## Task 6 - Update UI tests and expectations
Files:
- packages/ui-kit/src/components/__tests__/ActivityBar.test.tsx
- packages/ui-kit/src/components/__tests__/PanelHeader.test.tsx
- packages/ui-kit/src/components/__tests__/StatusBar.test.tsx
- packages/ui-kit/src/components/__tests__/ShellLayout.test.tsx
- apps/electron-shell/src/renderer/components/editor/EditorTabBar.test.tsx
- apps/electron-shell/src/renderer/components/explorer/FileTree.test.tsx
Verification:
- pnpm --filter packages/ui-kit test
- pnpm --filter apps/electron-shell test
Invariants:
- Tests reflect token based styling and VS Code like structure

## Task 7 - Capture VS Code alignment screenshots
Files:
- specs/110-vscode-ui-ux/screenshots/before.png
- specs/110-vscode-ui-ux/screenshots/after.png
Verification:
- Manual visual review
Invariants:
- Screenshot required by WARP rules
- Show activity bar, sidebars, editor tabs, bottom panel, status bar

## Task 8 - Final verification
Files:
- None (verification only)
Verification:
- pnpm -r lint
- pnpm -r test
Invariants:
- No regressions in Monaco lazy load or security defaults
