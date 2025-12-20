# 040 Monaco Lazy Editor — Technical Plan

## Architecture changes
This feature introduces lazy-loaded Monaco Editor to the renderer process while maintaining strict process isolation (P1) and performance budgets (P5).

### Component architecture
- Replace `EditorPlaceholder` component with new `MonacoEditor` component that uses React.lazy() + dynamic import
- Add `EditorLoader` component to handle loading/error/success states
- Keep editor state (content, language, cursor position) in FileTreeContext for now
- Monaco loads only when `EditorArea` mounts with an active file
- Add `BreadcrumbsBar` component below the editor tab strip (file path + symbol path)
- Add `MenuBar` component at the top of the renderer to mirror VS Code menus
- Wire Settings toggles to show/hide breadcrumbs and menu bar

### Build configuration changes
- Add Monaco worker configuration to `vite.renderer.config.ts`
- Install `monaco-editor` package (~3MB minified, will be code-split)
- Configure Vite to:
  - Bundle Monaco in separate chunk(s) via manual chunks or automatic code-splitting
  - Output Monaco workers as separate assets with correct MIME types
  - Set worker paths so Monaco can locate workers at runtime

### Process isolation
- **No changes to process boundaries**: Monaco runs entirely in sandboxed renderer
- Monaco has no Node.js access (P1 already enforced by contextIsolation)
- No new IPC channels required — editor operates on in-memory content only
- File I/O remains main-process only via existing fs-broker contracts

## Contracts (api-contracts updates)
Update Settings schema to add UI toggles for breadcrumbs and menu bar (contracts-first).

Required schema updates:
- `appearance.menuBarVisible: boolean` (default: true)
- `editor.breadcrumbsEnabled: boolean` (default: true)

Rationale:
- Settings are already fetched via existing IPC channels (`GET_SETTINGS`, `UPDATE_SETTINGS`, `RESET_SETTINGS`)
- No new IPC channels required for breadcrumbs or menu bar
- Monaco remains client-side; file content still uses `IPC_CHANNELS.FS_READ_FILE`

Future considerations (out of scope):
- When adding file save functionality, add `FS_WRITE_FILE` channel to `ipc-channels.ts`
- When adding LSP/IntelliSense from extensions, add extension API contracts

## IPC + process boundaries
**No new IPC channels.**

Existing IPC flows remain unchanged:
- Main process: owns file system via fs-broker (already implemented)
- Renderer: receives file content via `FS_READ_FILE`, passes to Monaco
- Preload: exposes existing contextBridge API (no changes)
- Renderer menu bar actions call existing menu IPC events (no new OS access)

Security boundaries:
- Monaco executes in sandboxed renderer (no eval allowed by CSP)
- Monaco workers run as Web Workers (same sandbox as renderer)
- Content Security Policy must allow `worker-src 'self'` for Monaco workers
- No external CDN resources — all Monaco assets bundled locally

## UI components and routes
### New components
**`src/renderer/components/editor/MonacoEditor.tsx`**
- Props: `{ filePath: string, content: string, language: string, onChange?: (content: string) => void }`
- Uses dynamic import: `const monaco = await import('monaco-editor')`
- Lifecycle:
  - Mount: initialize Monaco editor instance, set content, language
  - Update: update content/language if filePath changes
  - Unmount: dispose editor instance and models
- Handles resize events to call `editor.layout()`

**`src/renderer/components/editor/EditorLoader.tsx`**
- Loading state: spinner + "Loading Editor..." message
- Error state: error message + retry button
- Success state: renders MonacoEditor component
- Uses React.lazy() and Suspense boundary

**`src/renderer/components/editor/BreadcrumbsBar.tsx`**
- Props: `{ filePath: string | null, symbols: BreadcrumbSymbol[], onNavigateFile: (path: string) => void, onNavigateSymbol: (symbol: BreadcrumbSymbol) => void }`
- Renders file path segments + symbol segments with VS Code spacing and separators
- Handles overflow (scroll or "..." overflow indicator)
- Uses Tailwind tokens for colors and hover states

**`src/renderer/components/layout/MenuBar.tsx`**
- Renders VS Code-style menu labels: File, Edit, Selection, View, Go, Run, Terminal, Help
- Supports keyboard focus and arrow navigation
- Dispatches existing menu IPC events for core actions

### Modified components
**`src/renderer/components/editor/EditorArea.tsx`**
- Replace `<EditorPlaceholder />` with `<EditorLoader />`
- Add Suspense boundary with loading fallback
- Fetch file content via `window.electron.ipcRenderer.invoke('fs:read-file', filePath)`
- Pass content + language (inferred from file extension) to MonacoEditor
- Render `BreadcrumbsBar` below the tab strip when enabled in settings
- Use Monaco symbol providers to compute symbol breadcrumbs (debounced)

**`src/renderer/App.tsx`**
- Render `MenuBar` above `<ShellLayout>` when enabled in settings

**`src/renderer/components/editor/EditorPlaceholder.tsx`**
- Keep for empty state (no file open)
- No longer shown when file is open (EditorLoader/MonacoEditor takes over)

### No routing changes
- Feature operates within existing EditorArea component
- No new routes or navigation required

## Data model changes
**Settings schema updates (api-contracts):**
- `appearance.menuBarVisible: boolean` (default true)
- `editor.breadcrumbsEnabled: boolean` (default true)

In-memory state changes (FileTreeContext):
- Add optional `fileContents: Map<string, string>` to cache loaded file contents
- Add `editorState: Map<string, { cursorPosition, scrollPosition }>` for future persistence (optional, can defer)
- Add `breadcrumbSymbols: Map<string, BreadcrumbSymbol[]>` cache for symbol results per file

No persistence layer changes:
- Monaco configuration is ephemeral (per-session only)
- File content is read-only for now (save functionality deferred)

## Failure modes + recovery
### Monaco load failure
- **Cause**: Network error (unlikely since bundled), Vite misconfiguration, corrupted chunk
- **Detection**: `import('monaco-editor')` throws exception
- **Recovery**: EditorLoader shows error state with retry button
- **UX**: "Failed to load editor. Please try again." + Retry button triggers re-import

### Monaco initialization failure
- **Cause**: DOM not ready, worker path misconfigured, CSP violation
- **Detection**: `monaco.editor.create()` throws exception
- **Recovery**: EditorLoader shows error + fallback to read-only text display
- **Logging**: Log error to console (no telemetry in this phase)

### Worker loading failure
- **Cause**: Incorrect worker path, MIME type mismatch, CSP blocking workers
- **Detection**: Monaco shows warning "Could not create web worker"
- **Recovery**: Monaco degraded mode (no IntelliSense, basic syntax highlighting)
- **Testing**: Verify `worker-src 'self'` in CSP, test in built app (not just dev)

### Breadcrumb symbol provider failure
- **Cause**: Language does not provide symbols, provider throws, or model not ready
- **Detection**: Symbol query returns empty or throws error
- **Recovery**: Show file-path breadcrumbs only and retry on next cursor change
- **Logging**: Console warning (no telemetry)

### Performance degradation
- **Cause**: Large file (>1MB), too many models loaded
- **Detection**: Editor becomes unresponsive, UI thread blocked
- **Recovery**: Add file size warning (>1MB), limit open tabs (future)
- **Monitoring**: Verify <2s time-to-interactive in acceptance testing

## Testing strategy
### Unit tests (Vitest)
- `MonacoEditor.test.tsx`: Test dynamic import, editor initialization, dispose
- `EditorLoader.test.tsx`: Test loading/error/success states, retry logic
- `BreadcrumbsBar.test.tsx`: Test file + symbol segments, overflow handling, click callbacks
- `MenuBar.test.tsx`: Test focus/keyboard navigation and visibility toggle
- Mock `monaco-editor` module to avoid loading real Monaco in tests

### Integration tests (Vitest + jsdom)
- `EditorArea.test.tsx`: Test file open → Monaco load → content display
- Mock IPC calls to return file content
- Verify Monaco chunk not imported when no file is open

### E2E tests (Playwright)
- **Test 1**: App startup → verify Monaco not loaded (check network tab)
- **Test 2**: Open file → verify Monaco loads → verify syntax highlighting works
- **Test 3**: Open TypeScript file → verify IntelliSense completions work
- **Test 4**: Close tab → verify Monaco disposes resources

### Build verification
- Run `pnpm -r build` → analyze output
- Verify Monaco in separate chunk (not in `index-<hash>.js`)
- Verify chunk sizes:
  - Monaco core: <500KB gzipped
  - Each worker: <200KB gzipped
- Use `rollup-plugin-visualizer` or Vite bundle analyzer

### Performance verification
- Measure initial bundle size (should decrease after Monaco extracted)
- Measure time-to-interactive for editor (<2s after import)
- Test on slow network (throttle to 3G) to verify loading state UX

### Verification commands
```bash
# Type checking
pnpm -r typecheck

# Linting
pnpm -r lint

# Unit tests
pnpm -r test

# Build and analyze
pnpm -r build
# Manual: inspect apps/electron-shell/.vite/build/renderer/ for chunk sizes

# E2E tests (after implementation)
pnpm test:e2e --grep "monaco"
```

## Rollout / migration
**No migration required** — feature is additive, no breaking changes.

### Installation steps
1. Install dependencies:
   ```bash
   pnpm add monaco-editor -w apps/electron-shell
   pnpm add -D @types/monaco-editor -w apps/electron-shell
   ```

2. Update Vite config → add worker configuration

3. Implement components → replace placeholder

4. Test locally → verify dev mode works

5. Test built app → verify production build works (workers load correctly)

### Rollback plan
If Monaco integration causes issues:
- Revert to `EditorPlaceholder` component
- Remove `monaco-editor` dependency
- No data loss (no persistence layer yet)

## Risks + mitigations
### Risk 1: Monaco chunk too large (>500KB gzipped)
- **Impact**: Violates performance budget P5
- **Likelihood**: Medium (Monaco core is ~300KB gzipped by default)
- **Mitigation**: 
  - Only import used languages (TypeScript, JavaScript, JSON, Markdown)
  - Use `monaco-editor/esm/vs/editor/editor.api` for tree-shaking
  - Defer unused features (diff editor, minimap customization)

### Risk 2: Workers fail in built app (but work in dev)
- **Impact**: No IntelliSense, degraded editor experience
- **Likelihood**: Medium (common Vite + Monaco issue)
- **Mitigation**:
  - Test built app early (not just `pnpm dev`)
  - Use `MonacoWebpackPlugin` equivalent for Vite (manual worker config)
  - Set `MonacoEnvironment.getWorkerUrl` to resolve worker paths correctly

### Risk 3: CSP blocks Monaco workers
- **Impact**: Editor fails to initialize, app unusable
- **Likelihood**: Low (CSP already allows `worker-src 'self'`)
- **Mitigation**:
  - Verify CSP in main process window creation
  - Add `script-src 'self' 'wasm-unsafe-eval'` if Monaco uses WASM (check)
  - Test in built app with strict CSP

### Risk 4: React state conflicts (multiple editor instances)
- **Impact**: Editor content out of sync, UI glitches
- **Likelihood**: Low (only one editor instance per tab)
- **Mitigation**:
  - Ensure Monaco editor is disposed on unmount
  - Use unique `key` prop for EditorArea when filePath changes
  - Add integration test for tab switching

### Risk 5: Performance regression on startup
- **Impact**: App feels slower despite lazy-loading
- **Likelihood**: Low (Monaco won't load until file opens)
- **Mitigation**:
  - Measure baseline startup time before implementation
  - Verify Monaco NOT in initial bundle via build analysis
  - Add performance test: app start → time to first paint (<500ms unchanged)

### Risk 6: Breadcrumb symbol extraction is slow on large files
- **Impact**: Breadcrumbs lag or UI stutters while typing
- **Likelihood**: Medium (symbol providers can be expensive)
- **Mitigation**:
  - Debounce symbol queries (e.g., 150-250ms)
  - Cache symbol results per model version
  - Fall back to file-path breadcrumbs when symbol query exceeds time budget

### Risk 7: Menu bar focus conflicts with editor shortcuts
- **Impact**: Alt key or arrow keys interfere with Monaco navigation
- **Likelihood**: Medium (depends on platform)
- **Mitigation**:
  - Scope menu keyboard handling to focused menubar
  - Use Alt to focus menu bar only when no modal or input is focused
  - Add regression tests for key handling

## Done definition
### Code complete
- [ ] `MonacoEditor.tsx` component implemented with dynamic import
- [ ] `EditorLoader.tsx` component implemented with loading/error/success states
- [ ] `EditorArea.tsx` updated to use EditorLoader + fetch file content
- [ ] `BreadcrumbsBar.tsx` component implemented (file + symbol breadcrumbs)
- [ ] `MenuBar.tsx` component implemented (VS Code-style top menu)
- [ ] Settings toggles added for breadcrumbs and menu bar (schema + UI)
- [ ] App layout updated to render menu bar above ShellLayout
- [ ] `vite.renderer.config.ts` updated with Monaco worker configuration
- [ ] Unit tests written and passing for new components
- [ ] E2E test written for Monaco load + syntax highlighting

### Verification complete
- [ ] `pnpm -r typecheck` passes (no TypeScript errors)
- [ ] `pnpm -r lint` passes (no ESLint errors)
- [ ] `pnpm -r test` passes (all unit tests green)
- [ ] `pnpm -r build` succeeds and produces correct chunks
- [ ] Build analysis confirms Monaco in separate chunk (not in initial bundle)
- [ ] Monaco chunk sizes meet performance budget (<500KB core, <200KB workers)
- [ ] Manual testing: app starts without loading Monaco assets
- [ ] Manual testing: opening TypeScript file loads Monaco + IntelliSense works
- [ ] Manual testing: loading state shows spinner while Monaco initializes
- [ ] Manual testing: error handling works (simulate load failure)
- [ ] Manual testing: breadcrumbs render and navigate correctly
- [ ] Manual testing: menu bar renders and responds to keyboard focus
- [ ] Manual testing: settings toggles show/hide breadcrumbs and menu bar
- [ ] Screenshot captured for visual diff per WARP.md

### Documentation complete
- [ ] Update `EditorArea.tsx` component docstring to reflect Monaco integration
- [ ] Add comments in `vite.renderer.config.ts` explaining worker configuration
- [ ] Mark acceptance criteria in `spec.md` as complete
