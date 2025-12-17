# 010-shell-layout — Implementation Tasks

## Task 1 — Add LayoutState contract to api-contracts
**Description**: Define LayoutState Zod schema in api-contracts (contracts-first approach per P6).

**Files to create/modify**:
- `packages/api-contracts/src/types/layout-state.ts` (create)
- `packages/api-contracts/src/index.ts` (modify: add export)

**Implementation details**:
- Create `LayoutStateSchema` with Zod validation:
  - `primarySidebarWidth`: z.number().int().min(200).max(600).default(300)
  - `secondarySidebarWidth`: z.number().int().min(200).max(600).default(300)
  - `bottomPanelHeight`: z.number().int().min(100).max(600).default(200)
  - `primarySidebarCollapsed`: z.boolean().default(false)
  - `secondarySidebarCollapsed`: z.boolean().default(true)
  - `bottomPanelCollapsed`: z.boolean().default(false)
  - `activeActivityBarIcon`: z.enum(['explorer', 'search', 'source-control', 'run-debug', 'extensions', 'settings']).default('explorer')
- Export TypeScript type: `export type LayoutState = z.infer<typeof LayoutStateSchema>;`
- Export default: `export const DEFAULT_LAYOUT_STATE: LayoutState = LayoutStateSchema.parse({});`
- Add TSDoc comments for all exports

**Verification commands**:
```powershell
pnpm --filter packages-api-contracts typecheck
pnpm --filter packages-api-contracts lint
pnpm --filter packages-api-contracts build
```

**Invariants that must remain true**:
- **P6 (Contracts-first)**: All layout state types defined in api-contracts BEFORE renderer implementation
- **P1 (Process isolation)**: No IPC contracts added (layout is renderer-only, localStorage-based)
- **P2 (Security defaults)**: No secrets in layout state schema (only UI dimensions and boolean flags)

---

## Task 2 — Setup packages/ui-kit package infrastructure
**Description**: Convert ui-kit from placeholder to functional React component library with build tooling.

**Files to create/modify**:
- `packages/ui-kit/package.json` (modify: add dependencies and scripts)
- `packages/ui-kit/tsconfig.json` (create)
- `packages/ui-kit/vite.config.ts` (create)
- `packages/ui-kit/vitest.config.ts` (create)
- `packages/ui-kit/.eslintrc.cjs` (create)
- `packages/ui-kit/src/index.ts` (create: barrel export file)

**Implementation details**:
- Add dependencies to package.json:
  - `react@^18.2.0`, `react-dom@^18.2.0`
  - `packages-api-contracts@workspace:*`
- Add devDependencies:
  - `@types/react@^18.2.0`, `@types/react-dom@^18.2.0`
  - `vite@^6.x`, `@vitejs/plugin-react@^4.x`
  - `vitest@^2.x`, `@testing-library/react@^14.x`, `@testing-library/jest-dom@^6.x`
  - `typescript@^5.x`
- Update scripts:
  - `"build": "vite build"`
  - `"typecheck": "tsc --noEmit"`
  - `"lint": "eslint src --ext .ts,.tsx"`
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"clean": "rm -rf dist"`
- Configure Vite for library mode (output ES modules)
- Configure Vitest with React Testing Library setup
- Configure ESLint (extend from root config)

**Verification commands**:
```powershell
pnpm install
pnpm --filter packages-ui-kit typecheck  # should pass (no source files yet)
pnpm --filter packages-ui-kit lint       # should pass
pnpm --filter packages-ui-kit build      # should create dist/ folder
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: ui-kit has NO Electron dependencies (pure React, renderer-only)
- **P4 (UI design system)**: No CSS-in-JS libraries (Tailwind 4 tokens only, consumed via className props)
- **P6 (Contracts-first)**: ui-kit imports LayoutState from api-contracts

---

## Task 3 — Implement ui-kit core components (ShellLayout, ResizablePanel)
**Description**: Build foundational layout components with CSS Grid and drag-to-resize.

**Files to create/modify**:
- `packages/ui-kit/src/components/ShellLayout.tsx` (create)
- `packages/ui-kit/src/components/ResizablePanel.tsx` (create)
- `packages/ui-kit/src/index.ts` (modify: add exports)

**Implementation details**:
- **ShellLayout**:
  - Props: `activityBar`, `primarySidebar`, `editorArea`, `secondarySidebar`, `bottomPanel`, `statusBar`, `layoutState`, `onLayoutChange`
  - CSS Grid layout with 6 regions
  - Responsive: uses `minmax()` for flexible columns
  - Controlled component (no internal state)
  - TSDoc comments with usage example
- **ResizablePanel**:
  - Props: `direction`, `size`, `minSize`, `maxSize`, `collapsed`, `onResize`, `onToggleCollapse`, `children`
  - Drag handle with `onMouseDown` → `mousemove` → `mouseup` event flow
  - Clamps size to `[minSize, maxSize]` before emitting `onResize`
  - Uses `React.memo` for performance
  - Uses `requestAnimationFrame` for smooth 60fps drag updates
  - Collapse button in panel header
  - TSDoc comments

**Verification commands**:
```powershell
pnpm --filter packages-ui-kit typecheck
pnpm --filter packages-ui-kit lint
pnpm --filter packages-ui-kit build
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Components use only browser APIs (no Node.js, no Electron)
- **P4 (UI design system)**: All styling via Tailwind className props (e.g., `bg-gray-900`, `border-gray-700`)
- **P5 (Performance budgets)**: ResizablePanel uses `requestAnimationFrame` and `React.memo` for 60fps target

---

## Task 4 — Implement ui-kit supporting components (ActivityBar, StatusBar, PanelHeader)
**Description**: Build activity bar, status bar, and panel header components.

**Files to create/modify**:
- `packages/ui-kit/src/components/ActivityBar.tsx` (create)
- `packages/ui-kit/src/components/StatusBar.tsx` (create)
- `packages/ui-kit/src/components/PanelHeader.tsx` (create)
- `packages/ui-kit/src/index.ts` (modify: add exports)

**Implementation details**:
- **ActivityBar**:
  - Props: `activeIcon`, `onIconClick`
  - Renders 6 vertical icons (placeholder SVG or text: Explorer, Search, Source Control, Run & Debug, Extensions, Settings)
  - Active icon has `bg-blue-600` class
  - Click handler emits icon ID
  - Fixed width: 48px
- **StatusBar**:
  - Props: `leftContent`, `rightContent`
  - Two-section layout: left (workspace name), right (status items)
  - Fixed height: 24px
  - Background: `bg-blue-900`
- **PanelHeader**:
  - Props: `title`, `collapsed`, `onToggleCollapse`
  - Displays title + collapse/expand button
  - Button icon changes based on `collapsed` state (chevron up/down)
  - Used by sidebars and bottom panel

**Verification commands**:
```powershell
pnpm --filter packages-ui-kit typecheck
pnpm --filter packages-ui-kit lint
pnpm --filter packages-ui-kit build
```

**Invariants that must remain true**:
- **P4 (UI design system)**: All components use Tailwind 4 tokens (no inline styles, no hardcoded colors)
- **P1 (Process isolation)**: No Electron APIs, pure React components

---

## Task 5 — Add unit tests for ui-kit components
**Description**: Write unit tests for all 5 ui-kit components using Vitest + React Testing Library.

**Files to create/modify**:
- `packages/ui-kit/src/components/__tests__/ShellLayout.test.tsx` (create)
- `packages/ui-kit/src/components/__tests__/ResizablePanel.test.tsx` (create)
- `packages/ui-kit/src/components/__tests__/ActivityBar.test.tsx` (create)
- `packages/ui-kit/src/components/__tests__/StatusBar.test.tsx` (create)
- `packages/ui-kit/src/components/__tests__/PanelHeader.test.tsx` (create)
- `packages/ui-kit/src/test-setup.ts` (create: Vitest setup with @testing-library/jest-dom)

**Implementation details**:
- **ShellLayout tests**:
  - Renders all 6 regions with correct content
  - Calls `onLayoutChange` when layout state changes
- **ResizablePanel tests**:
  - Drag handle updates size on mousemove
  - Clamps size to min/max bounds
  - Toggle button emits `onToggleCollapse`
  - Collapsed state hides content
- **ActivityBar tests**:
  - Renders 6 icons
  - Active icon has correct class
  - Clicking icon calls `onIconClick` with ID
- **StatusBar tests**:
  - Renders left and right content in correct sections
- **PanelHeader tests**:
  - Displays title
  - Toggle button icon changes based on `collapsed` prop
- Target: 80%+ coverage

**Verification commands**:
```powershell
pnpm --filter packages-ui-kit test
pnpm --filter packages-ui-kit typecheck
pnpm --filter packages-ui-kit lint
```

**Invariants that must remain true**:
- **P6 (Contracts-first)**: Tests validate LayoutState schema constraints (min/max sizes)
- **P5 (Performance budgets)**: No performance regressions (tests should run in <5s)

---

## Task 6 — Add useLayoutState hook in electron-shell renderer
**Description**: Create custom hook for localStorage persistence with Zod validation.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/hooks/useLayoutState.ts` (create)
- `apps/electron-shell/src/renderer/utils/localStorage.ts` (create)

**Implementation details**:
- **useLayoutState**:
  - Returns `[state, setState]` tuple (like `useState`)
  - On mount: read from localStorage, parse with Zod, fallback to `DEFAULT_LAYOUT_STATE` on error
  - On state change: debounce 200ms, write to localStorage
  - localStorage key: `"ai-shell:layout-state:global"`
  - Error handling: catch Zod validation errors, log warning, clear corrupted value
  - TSDoc comments
- **localStorage utility**:
  - `getLayoutState(key: string): LayoutState | null`
  - `setLayoutState(key: string, state: LayoutState): void`
  - Wraps JSON.parse/stringify with try/catch
  - Uses Zod schema to validate on read

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Hook uses only browser localStorage API (no Node.js, no IPC)
- **P2 (Security defaults)**: No secrets stored in localStorage (only UI dimensions)
- **P6 (Contracts-first)**: Hook imports LayoutState and schema from api-contracts

---

## Task 7 — Add LayoutContext and LayoutProvider in electron-shell renderer
**Description**: Create React context for layout state management with context splitting.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/contexts/LayoutContext.tsx` (create)

**Implementation details**:
- **LayoutContext**:
  - Context value shape:
    - `state: LayoutState`
    - `updatePrimarySidebarWidth(width: number): void`
    - `updateSecondarySidebarWidth(width: number): void`
    - `updateBottomPanelHeight(height: number): void`
    - `togglePrimarySidebar(): void`
    - `toggleSecondarySidebar(): void`
    - `toggleBottomPanel(): void`
    - `setActiveActivityBarIcon(icon: string): void`
    - `resetLayout(): void`
  - Uses `useLayoutState` hook internally
  - All update functions use Zod schema to validate new values
  - `resetLayout` clears localStorage and resets to default state
- **LayoutProvider**:
  - Wraps children with context provider
  - Registers keyboard shortcuts (Ctrl+B, Ctrl+J, Ctrl+Shift+E) with `useEffect`
  - Prevents default browser behavior for shortcuts
  - TSDoc comments

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Context uses only browser APIs (keyboard events, localStorage)
- **P6 (Contracts-first)**: Context imports LayoutState from api-contracts
- **P5 (Performance budgets)**: Context splitting to prevent unnecessary re-renders

---

## Task 8 — Create layout placeholder components in electron-shell renderer
**Description**: Build placeholder components for explorer, editor, and terminal panels.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx` (create)
- `apps/electron-shell/src/renderer/components/layout/EditorPlaceholder.tsx` (create)
- `apps/electron-shell/src/renderer/components/layout/TerminalPanel.tsx` (create)
- `apps/electron-shell/src/renderer/components/layout/AIAssistantPanel.tsx` (create)

**Implementation details**:
- **ExplorerPanel**: Displays "No folder open" centered text
- **EditorPlaceholder**: Displays "Open a file to start editing" centered text
- **TerminalPanel**: Header "Terminal" + "No terminal sessions" text
- **AIAssistantPanel**: Displays "AI Assistant" (placeholder for secondary sidebar)
- All use Tailwind classes: `flex items-center justify-center h-full text-gray-400`
- TSDoc comments

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Placeholder components are pure React (no Node.js, no IPC)
- **P4 (UI design system)**: All styling via Tailwind 4 tokens

---

## Task 9 — Update electron-shell App.tsx to use ShellLayout
**Description**: Refactor App.tsx to render ShellLayout with LayoutProvider and all 6 regions.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/App.tsx` (modify)
- `apps/electron-shell/package.json` (modify: add ui-kit dependency)

**Implementation details**:
- Add dependency: `"packages-ui-kit": "workspace:*"` to package.json
- Import components from ui-kit: `ShellLayout`, `ResizablePanel`, `ActivityBar`, `StatusBar`, `PanelHeader`
- Import context: `LayoutProvider`, `useLayoutContext`
- Import placeholder panels: `ExplorerPanel`, `EditorPlaceholder`, `TerminalPanel`, `AIAssistantPanel`
- Wrap app in `<LayoutProvider>`
- Use `useLayoutContext` to get state and actions
- Render `<ShellLayout>` with all 6 regions:
  - Activity Bar: `<ActivityBar>` with placeholder icons
  - Primary Sidebar: `<ResizablePanel>` wrapping `<ExplorerPanel>`
  - Editor Area: `<EditorPlaceholder>`
  - Secondary Sidebar: `<ResizablePanel>` wrapping `<AIAssistantPanel>`
  - Bottom Panel: `<ResizablePanel>` wrapping `<TerminalPanel>`
  - Status Bar: `<StatusBar>` with "No Folder Open" text
- Remove old centered layout code

**Verification commands**:
```powershell
pnpm install
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm --filter apps-electron-shell build
pnpm dev  # manual: verify layout renders in running app
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: App.tsx remains in sandboxed renderer (no Node.js access)
- **P2 (Security defaults)**: Verify in DevTools: `typeof process === "undefined"`
- **P4 (UI design system)**: All styling via Tailwind 4 tokens
- **P5 (Performance budgets)**: Initial render <50ms (verify in DevTools Performance tab)

---

## Task 10 — Add integration tests for renderer layout logic
**Description**: Write integration tests for LayoutContext, useLayoutState, and keyboard shortcuts.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/hooks/__tests__/useLayoutState.test.ts` (create)
- `apps/electron-shell/src/renderer/contexts/__tests__/LayoutContext.test.tsx` (create)
- `apps/electron-shell/vitest.config.ts` (create or modify)

**Implementation details**:
- **useLayoutState tests**:
  - Reads from localStorage on mount
  - Writes to localStorage on state change (debounced)
  - Resets to default if value is invalid (Zod validation fails)
  - Handles QuotaExceededError gracefully
- **LayoutContext tests**:
  - Provides default state on mount
  - Updates state via action functions
  - Keyboard shortcuts trigger correct actions (simulate keydown events)
  - `resetLayout` clears localStorage
- Mock localStorage with `vi.stubGlobal('localStorage', ...)`
- Target: 70%+ coverage for renderer code

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell test
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P6 (Contracts-first)**: Tests validate Zod schema constraints
- **P2 (Security defaults)**: Tests verify no secrets in localStorage

---

## Task 11 — Add E2E tests for shell layout with Playwright
**Description**: Write E2E tests for layout rendering, resizing, collapsing, and persistence.

**Files to create/modify**:
- `test/e2e/shell-layout.spec.ts` (create)

**Implementation details**:
- **Test 1: Layout rendering**:
  - Launch app, verify all 6 regions visible
  - Verify Activity Bar has 6 icons
  - Verify Status Bar displays "No Folder Open"
- **Test 2: Panel resizing**:
  - Drag Primary Sidebar handle right 100px
  - Verify sidebar width increases
  - Close/reopen app, verify width persisted
- **Test 3: Panel collapsing**:
  - Click Primary Sidebar toggle button, verify collapsed
  - Press Ctrl+B (or Cmd+B on Mac), verify expanded
  - Close/reopen app, verify state persisted
- **Test 4: Keyboard shortcuts**:
  - Press Ctrl+J, verify Bottom Panel collapses
  - Press Ctrl+J again, verify expands
- **Test 5: Activity Bar interaction**:
  - Click Search icon, verify active state changes
  - Close/reopen app, verify active icon persisted
- Use Playwright's Electron support
- Use `electronApp.evaluate()` to access localStorage

**Verification commands**:
```powershell
pnpm test:e2e
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Tests verify renderer sandbox (no `process` or `require` in DevTools)
- **P2 (Security defaults)**: Tests verify no secrets in localStorage
- **P5 (Performance budgets)**: Tests verify resize maintains 60fps (no dropped frames)

---

## Task 12 — Update documentation (README, architecture, CONTRIBUTING)
**Description**: Document shell layout system and component usage.

**Files to create/modify**:
- `README.md` (modify: add shell layout feature description)
- `docs/architecture.md` (modify: add "Layout System" section)
- `CONTRIBUTING.md` (modify: add "Adding layout panels" guide)

**Implementation details**:
- **README.md**:
  - Add feature list: VS Code-like layout with 6 regions
  - Add screenshot or ASCII diagram of layout
  - List keyboard shortcuts (Ctrl+B, Ctrl+J, Ctrl+Shift+E)
- **docs/architecture.md**:
  - New section: "Layout System"
  - Explain LayoutContext, useLayoutState, localStorage persistence
  - Document layout state schema and defaults
  - Explain context splitting for performance
- **CONTRIBUTING.md**:
  - New section: "Adding layout panels"
  - Step-by-step guide with code example
  - Explain how to add new panel to ShellLayout
  - Link to ui-kit component API docs

**Verification commands**:
```powershell
# No automated verification (documentation only)
# Manual: review docs for clarity and accuracy
```

**Invariants that must remain true**:
- **P7 (Spec-Driven Development)**: Documentation reflects spec.md and plan.md
- **P1 (Process isolation)**: Documentation emphasizes renderer-only layout (no IPC)
- **P6 (Contracts-first)**: Documentation shows LayoutState schema from api-contracts

---

## Task 13 — Final validation and acceptance criteria verification
**Description**: Run all verification commands and manually verify acceptance criteria.

**Files to create/modify**:
- None (verification only)

**Verification commands**:
```powershell
# Clean build
pnpm -r clean
pnpm install

# Verify all packages
pnpm -r typecheck  # 0 TypeScript errors
pnpm -r lint       # 0 ESLint errors
pnpm -r test       # All unit + integration tests pass
pnpm -r build      # Clean build with no warnings

# E2E tests
pnpm test:e2e      # All 5 E2E tests pass

# Manual verification
pnpm dev           # Launch app, verify all 6 layout regions render
```

**Manual verification checklist**:
1. Launch app, verify all 6 layout regions render
2. Drag Primary Sidebar handle, verify smooth resize at 60fps
3. Press Ctrl+B, verify sidebar collapses/expands
4. Press Ctrl+J, verify bottom panel collapses/expands
5. Click Activity Bar icons, verify active state changes
6. Close app, reopen, verify layout state persisted (panel sizes + collapsed states)
7. Open Chrome DevTools:
   - Console: `typeof process` → `"undefined"` ✓
   - Console: `typeof require` → `"undefined"` ✓
   - Application → Local Storage: verify layout state stored, no secrets
8. Clear localStorage, reload app, verify default layout renders
9. Performance tab: verify initial render <50ms
10. Performance tab: record drag operation, verify no dropped frames (60fps)

**Invariants that must remain true**:
- **P1 (Process isolation)**: Renderer sandboxed, no Node.js access, no IPC handlers added to main
- **P2 (Security defaults)**: contextIsolation ON, no secrets in logs/localStorage
- **P3 (Secrets)**: No .env files, no plaintext secrets
- **P4 (UI design system)**: All styling via Tailwind 4 tokens
- **P5 (Performance budgets)**: Initial render <50ms, resize 60fps, bundle ≤50KB increase
- **P6 (Contracts-first)**: LayoutState defined in api-contracts, all IPC contracts unchanged
- **P7 (Spec-Driven)**: Implementation matches spec.md and plan.md

**Acceptance criteria** (all 20 from spec.md):
1. ✅ Six distinct layout regions render correctly
2. ✅ Primary Sidebar resizable (200-600px, default 300px)
3. ✅ Secondary Sidebar resizable (200-600px, default 300px)
4. ✅ Bottom Panel resizable (100-600px, default 200px)
5. ✅ Primary Sidebar collapses via button or Ctrl+B
6. ✅ Bottom Panel collapses via button or Ctrl+J
7. ✅ Secondary Sidebar collapses via button
8. ✅ Layout state persists to localStorage on change
9. ✅ Layout state restores on app relaunch
10. ✅ Activity Bar icons highlight active state
11. ✅ Clicking Activity Bar icons updates active state
12. ✅ Status Bar displays "No Folder Open" and placeholder info
13. ✅ Drag handles visible on hover with resize cursor
14. ✅ Panel widths/heights clamped to minimum values
15. ✅ All layout components use Tailwind 4 tokens
16. ✅ Layout components exported from ui-kit with docs
17. ✅ Resize operations maintain 60fps
18. ✅ TypeScript compiles with 0 errors
19. ✅ ESLint passes with 0 errors
20. ✅ Playwright E2E test verifies layout, resize, persistence

---

## Summary

**Total tasks**: 13
**Estimated effort**: 5-7 days
**Critical path**: Task 1 (contracts) → Task 2-5 (ui-kit) → Task 6-9 (renderer) → Task 10-11 (tests) → Task 12-13 (docs + validation)

**Key dependencies**:
- Task 1 must complete first (contracts-first per P6)
- Tasks 2-5 (ui-kit) can run in parallel after Task 1
- Tasks 6-8 (renderer logic) depend on Task 1
- Task 9 (App.tsx) depends on Tasks 2-8
- Tasks 10-11 (tests) depend on Task 9
- Task 12 (docs) can run in parallel with Task 11
- Task 13 (validation) must be last

**Risk areas**:
- Task 9: Performance (60fps resize) — use `requestAnimationFrame` and `React.memo`
- Task 11: E2E test flakiness — ensure proper Electron app lifecycle in tests
- Task 13: Manual verification takes time — allocate 1-2 hours for thorough testing
