# 040 Monaco Lazy Editor — Tasks

## Task 1 — Install Monaco dependencies
**Objective**: Add monaco-editor package to electron-shell workspace.

**Files to modify**:
- `apps/electron-shell/package.json` (via pnpm add)

**Commands**:
```bash
pnpm add monaco-editor -w apps/electron-shell
pnpm add -D @types/monaco-editor -w apps/electron-shell
pnpm install
```

**Verify**:
- `pnpm -r typecheck` — no errors
- Verify monaco-editor appears in apps/electron-shell/package.json dependencies
- Verify @types/monaco-editor appears in devDependencies

**Invariants (Constitution)**:
- P1 (Process isolation): Monaco will run in renderer only (no main process changes)
- P5 (Performance budgets): Monaco not yet imported, so initial bundle unaffected

---

## Task 2 — Configure Vite for Monaco workers
**Objective**: Configure Vite renderer build to bundle Monaco workers correctly.

**Files to modify**:
- `apps/electron-shell/vite.renderer.config.ts`

**Changes**:
- Add Monaco worker configuration using manual worker setup
- Configure `optimizeDeps` to exclude monaco-editor from pre-bundling
- Set up `MonacoEnvironment.getWorkerUrl` pattern for runtime worker resolution
- Add comments explaining worker configuration (per plan Done definition)

**Commands**:
```bash
pnpm -r typecheck
pnpm -r lint
```

**Verify**:
- TypeScript compiles without errors
- ESLint passes
- Configuration includes worker path setup

**Invariants (Constitution)**:
- P1 (Process isolation): Workers run in renderer sandbox (Web Workers)
- P2 (Security defaults): No external CDN resources, all bundled locally
- P5 (Performance budgets): Monaco excluded from initial chunk (verify via optimizeDeps)

---

## Task 3 — Create MonacoEditor component
**Objective**: Implement core Monaco editor React component with dynamic import.

**Files to create**:
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.tsx`

**Implementation requirements**:
- Props: `{ filePath: string, content: string, language: string, onChange?: (content: string) => void }`
- Use dynamic import: `await import('monaco-editor')`
- Initialize editor in useEffect on mount
- Set content, language, read-only mode
- Handle resize events (editor.layout())
- Dispose editor and models on unmount
- Add comprehensive docstring referencing P1, P5 from constitution

**Commands**:
```bash
pnpm -r typecheck
pnpm -r lint
```

**Verify**:
- Component compiles without TypeScript errors
- ESLint passes
- Dynamic import syntax used (not static import)

**Invariants (Constitution)**:
- P1 (Process isolation): Component runs in sandboxed renderer, no Node.js APIs
- P5 (Performance budgets): Monaco loaded via dynamic import only
- P4 (UI design): Uses Tailwind 4 CSS variables for styling

---

## Task 4 — Create EditorLoader component
**Objective**: Implement loading/error/success state handler for Monaco.

**Files to create**:
- `apps/electron-shell/src/renderer/components/editor/EditorLoader.tsx`

**Implementation requirements**:
- Loading state: spinner + "Loading Editor..." message (P4 Tailwind 4 tokens)
- Error state: error message + retry button
- Success state: lazy-load and render MonacoEditor
- Use React.lazy() or manual dynamic import with state management
- Handle import failures gracefully
- Add docstring explaining lazy-loading strategy

**Commands**:
```bash
pnpm -r typecheck
pnpm -r lint
```

**Verify**:
- Component compiles without errors
- All three states (loading/error/success) implemented
- Retry logic present for error state

**Invariants (Constitution)**:
- P1 (Process isolation): Renderer-only component
- P4 (UI design): Uses CSS variables for colors, not hardcoded values
- P5 (Performance budgets): Lazy-loading pattern enforced

---

## Task 5 — Update EditorArea component
**Objective**: Integrate EditorLoader and fetch file content via IPC.

**Files to modify**:
- `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`

**Changes**:
- Import EditorLoader (not EditorPlaceholder when file is open)
- Add file content fetching via `window.electron.ipcRenderer.invoke('fs:read-file', filePath)`
- Infer language from file extension (.ts → typescript, .js → javascript, etc.)
- Pass content + language to EditorLoader/MonacoEditor
- Keep EditorPlaceholder for empty state (no file open)
- Add Suspense boundary with fallback
- Update docstring to reflect Monaco integration (per plan Done definition)

**Commands**:
```bash
pnpm -r typecheck
pnpm -r lint
```

**Verify**:
- TypeScript compiles
- No ESLint errors
- File content fetch uses existing IPC_CHANNELS.FS_READ_FILE

**Invariants (Constitution)**:
- P1 (Process isolation): File I/O via IPC only, renderer sandboxed
- P6 (Contracts-first): Uses existing api-contracts (no new contracts needed)
- P5 (Performance budgets): Monaco not loaded when no file open

---

## Task 6 — Add unit tests for MonacoEditor
**Objective**: Test Monaco editor initialization, content updates, disposal.

**Files to create**:
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.test.tsx`

**Test cases**:
- Mock monaco-editor module to avoid loading real Monaco
- Test editor initialization on mount
- Test content update when props change
- Test editor disposal on unmount
- Test language setting
- Test error handling for failed imports

**Commands**:
```bash
pnpm -r test
```

**Verify**:
- All tests pass
- Monaco module properly mocked
- Coverage for lifecycle methods

**Invariants (Constitution)**:
- P5 (Performance budgets): Tests verify Monaco not eagerly loaded

---

## Task 7 — Add unit tests for EditorLoader
**Objective**: Test loading/error/success state transitions.

**Files to create**:
- `apps/electron-shell/src/renderer/components/editor/EditorLoader.test.tsx`

**Test cases**:
- Mock dynamic import of MonacoEditor
- Test loading state renders spinner
- Test error state renders error message + retry button
- Test retry button triggers re-import
- Test success state renders MonacoEditor

**Commands**:
```bash
pnpm -r test
```

**Verify**:
- All tests pass
- State transitions work correctly
- Retry logic tested

**Invariants (Constitution)**:
- Testing verifies P5 lazy-loading behavior

---

## Task 8 — Update EditorArea integration tests
**Objective**: Test file open → Monaco load → content display flow.

**Files to modify**:
- `apps/electron-shell/src/renderer/components/editor/EditorArea.test.tsx` (if exists, else create)

**Test cases**:
- Mock IPC fs:read-file to return test content
- Test empty state shows EditorPlaceholder
- Test file open triggers Monaco load
- Test content passed to editor correctly
- Test language inference from file extension

**Commands**:
```bash
pnpm -r test
```

**Verify**:
- Integration tests pass
- IPC mocking works correctly

**Invariants (Constitution)**:
- P1 (Process isolation): Tests verify IPC boundary usage
- P6 (Contracts-first): Tests use existing api-contracts

---

## Task 9 — Run full verification suite
**Objective**: Ensure all code quality checks pass before build testing.

**Commands**:
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Verify**:
- TypeScript compilation succeeds (no errors)
- ESLint passes (no warnings/errors)
- All unit tests pass
- No regressions in existing tests

**Invariants (Constitution)**:
- All principles P1-P7 remain intact
- No new TypeScript errors introduced

---

## Task 10 — Build and verify bundle structure
**Objective**: Verify Monaco is code-split and meets performance budgets.

**Commands**:
```bash
pnpm -r build
```

**Manual verification**:
- Inspect `apps/electron-shell/.vite/build/renderer/` or `apps/electron-shell/out/`
- Confirm Monaco NOT in main index-*.js chunk
- Confirm separate Monaco chunk exists (e.g., monaco-editor-*.js)
- Verify chunk sizes:
  - Initial bundle should be smaller than before
  - Monaco core chunk: <500KB gzipped target
  - Worker chunks: <200KB each gzipped target

**Commands**:
```bash
# Build
pnpm -r build

# Manual inspection (PowerShell)
Get-ChildItem -Path "apps/electron-shell/.vite/build/renderer" -Recurse -File | Where-Object { $_.Name -like "*monaco*" }
```

**Verify**:
- Build succeeds without errors
- Monaco in separate chunk(s)
- Performance budgets met

**Invariants (Constitution)**:
- P5 (Performance budgets): Monaco lazy-loaded, not in initial chunk
- P2 (Security): All assets bundled locally, no CDN references

---

## Task 11 — Test in dev mode
**Objective**: Manually verify Monaco loads correctly in development.

**Commands**:
```bash
pnpm dev
```

**Manual testing steps**:
1. Start app → verify app launches without loading Monaco
2. Open workspace with files
3. Click on a TypeScript file in explorer
4. Verify loading spinner appears briefly
5. Verify Monaco editor loads and displays file content
6. Verify syntax highlighting works for TypeScript
7. Verify IntelliSense completions appear (type "const x = ")
8. Close tab → verify no errors in console
9. Open another file → verify editor updates correctly

**Verify**:
- Monaco loads on-demand
- Loading state visible
- Syntax highlighting functional
- IntelliSense works
- No console errors

**Invariants (Constitution)**:
- P1 (Process isolation): Renderer sandboxed, no Node.js access
- P5 (Performance budgets): Monaco not loaded on startup

---

## Task 12 — Test in built app
**Objective**: Verify Monaco workers load correctly in production build.

**Commands**:
```bash
pnpm -r build
# Run packaged app from apps/electron-shell/out/
```

**Manual testing steps**:
1. Launch built application
2. Open workspace
3. Open TypeScript file
4. Verify Monaco loads without errors
5. Verify workers load correctly (check DevTools console for worker errors)
6. Verify IntelliSense works (confirms workers functional)
7. Test error handling: disconnect network, reload, verify error state + retry

**Verify**:
- Built app launches successfully
- Monaco loads in production mode
- Workers load without CSP violations
- No "Could not create web worker" errors
- IntelliSense functional (confirms workers work)

**Invariants (Constitution)**:
- P1 (Process isolation): All processes properly isolated
- P2 (Security): CSP allows workers, no violations
- P5 (Performance budgets): Monaco lazy-loaded in production

---

## Task 13 — Add E2E test for Monaco loading
**Objective**: Create Playwright test to verify Monaco lazy-loading behavior.

**Files to create**:
- `test/e2e/monaco-editor.spec.ts`

**Test cases**:
- Test 1: App startup → verify Monaco chunk not loaded (check network requests)
- Test 2: Open file → verify Monaco loads → verify content displayed
- Test 3: Verify syntax highlighting applied (check for .mtk class or similar)
- Test 4: Close tab → verify editor unmounts cleanly

**Commands**:
```bash
pnpm test:e2e --grep "monaco"
```

**Verify**:
- E2E tests pass
- Monaco lazy-loading verified programmatically

**Invariants (Constitution)**:
- P5 (Performance budgets): Automated verification of lazy-loading
- P1 (Process isolation): E2E tests verify renderer sandbox

---


## Task 14 - Add settings schema for breadcrumbs and menu bar
**Objective**: Extend settings schema with visibility toggles (contracts-first).

**Files to modify**:
- `packages/api-contracts/src/types/settings.ts`
- `packages/api-contracts/src/index.ts` (if new exports are needed)

**Changes**:
- Add `appearance.menuBarVisible: boolean` (default true)
- Add `editor.breadcrumbsEnabled: boolean` (default true)
- Update `SETTINGS_DEFAULTS` to include new fields

**Commands**:
```bash
pnpm --filter packages-api-contracts typecheck
pnpm --filter packages-api-contracts lint
pnpm --filter packages-api-contracts build
```

**Verify**:
- Settings schema validates new fields
- Defaults include menu bar + breadcrumbs toggles

**Invariants (Constitution)**:
- P6 (Contracts-first): Update api-contracts before renderer changes
- P3 (Secrets): No secrets stored in settings

---

## Task 15 - Add Settings toggles for breadcrumbs and menu bar
**Objective**: Surface breadcrumbs/menu bar toggles in Settings UI.

**Files to modify**:
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`
- `apps/electron-shell/src/renderer/components/settings/SettingItem.tsx` (if needed)

**Changes**:
- Add "Show Menu Bar" toggle under Appearance
- Add "Show Breadcrumbs" toggle under Editor
- Wire toggles to `window.api.updateSettings()`

**Commands**:
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Verify**:
- Toggling settings updates persisted settings
- UI reflects current values on load

**Invariants (Constitution)**:
- P1 (Process isolation): Settings use IPC only (no direct file access)
- P4 (UI design): Use Tailwind token classes only

---

## Task 16 - Implement VS Code-style menu bar
**Objective**: Add a renderer menu bar that mirrors VS Code layout.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/layout/MenuBar.tsx` (create)
- `apps/electron-shell/src/renderer/App.tsx`
- `apps/electron-shell/src/renderer/styles/vscode-tokens.css` (add menu bar height token if needed)

**Changes**:
- Render menu bar above `<ShellLayout>` when `appearance.menuBarVisible` is true
- Add keyboard focus handling (Alt to focus, arrow key navigation)
- Dispatch existing menu IPC actions for core items (Open Folder, Close Folder, Toggle Panels)

**Commands**:
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Verify**:
- Menu bar renders with VS Code labels
- Keyboard navigation works
- Core actions invoke existing IPC/menu events

**Invariants (Constitution)**:
- P1 (Process isolation): No renderer OS access
- P4 (UI design): Uses CSS variables and Tailwind tokens

---

## Task 17 - Implement editor breadcrumbs (file + symbols)
**Objective**: Add breadcrumbs below the editor tabs with file + symbol segments.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/editor/BreadcrumbsBar.tsx` (create)
- `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.tsx` (if symbol hooks needed)

**Changes**:
- Build file-path segments from active tab path
- Query Monaco symbols to build symbol breadcrumbs (debounced)
- Navigate on click (file segments focus tab, symbol segments reveal symbol)
- Hide breadcrumbs when `editor.breadcrumbsEnabled` is false

**Commands**:
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Verify**:
- Breadcrumbs render below tabs and update on cursor move
- Clicking a breadcrumb navigates correctly

**Invariants (Constitution)**:
- P5 (Performance budgets): Breadcrumbs must not force Monaco into initial chunk
- P1 (Process isolation): Renderer-only logic

---

## Task 18 - Add tests for menu bar and breadcrumbs
**Objective**: Cover new UI with unit/integration tests.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/layout/MenuBar.test.tsx` (create)
- `apps/electron-shell/src/renderer/components/editor/BreadcrumbsBar.test.tsx` (create)
- `apps/electron-shell/src/renderer/components/editor/EditorArea.test.tsx` (update as needed)

**Commands**:
```bash
pnpm -r test
```

**Verify**:
- Tests pass for menu bar focus/navigation and breadcrumbs rendering

**Invariants (Constitution)**:
- P5 (Performance budgets): Tests verify lazy-loading remains intact

---

## Task 19 — Update spec.md acceptance criteria
**Objective**: Mark completed acceptance criteria in spec.

**Files to modify**:
- `specs/040-monaco-lazy-editor/spec.md`

**Changes**:
- Mark all completed acceptance criteria as [x]
- Verify all items addressed

**Verify**:
- All acceptance criteria reviewed
- All items marked complete

**Invariants (Constitution)**:
- P7 (Spec-Driven Development): Spec updated to reflect implementation state

---

## Task 20 — Final verification and documentation
**Objective**: Run complete verification suite and ensure documentation complete.

**Commands**:
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
pnpm test:e2e --grep "monaco"
```

**Documentation checklist**:
- [ ] `EditorArea.tsx` docstring updated (per plan Done definition)
- [ ] `vite.renderer.config.ts` has worker config comments (per plan Done definition)
- [ ] All new components have comprehensive docstrings
- [ ] Constitution principles (P1, P2, P4, P5) referenced in relevant comments

**Final verification**:
- All commands pass
- Monaco in separate chunk (build analysis)
- Chunk sizes within budgets (<500KB core, <200KB workers gzipped)
- Manual testing complete (dev + built app)
- E2E tests pass
- Documentation complete

**Invariants (Constitution)**:
- P1 (Process isolation): Renderer sandboxed, no Node.js access
- P2 (Security): contextIsolation ON, minimal preload API
- P4 (UI design): Tailwind 4 tokens used throughout
- P5 (Performance budgets): Monaco lazy-loaded, budgets met
- P6 (Contracts-first): Contracts updated before renderer changes
- P7 (Spec-Driven Development): Spec/plan/tasks complete and updated
