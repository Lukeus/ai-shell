# 010-shell-layout — Technical Plan

## Architecture changes

### New package: packages/ui-kit
Convert packages/ui-kit from placeholder to functional React component library:
- **Purpose**: Reusable layout components (ShellLayout, ResizablePanel, ActivityBar, StatusBar, PanelHeader)
- **Dependencies**: React 18, Tailwind 4 (via CSS imports from electron-shell)
- **Build**: Vite library mode with TypeScript, outputs ES modules
- **Exports**: Named exports for all layout components with TypeScript types
- **No breaking changes**: ui-kit is currently a placeholder, no existing consumers

### apps/electron-shell/src/renderer restructuring
Refactor renderer from single-file App.tsx to multi-directory structure:
- `App.tsx`: Root component, orchestrates ShellLayout with LayoutProvider
- `components/layout/`: Layout-specific wrapper components (ExplorerPanel, TerminalPanel placeholders)
- `hooks/useLayoutState.ts`: Custom hook for localStorage persistence logic
- `contexts/LayoutContext.tsx`: React context for layout state (uses context splitting for performance)
- `utils/localStorage.ts`: Utility for scoped localStorage (workspace-aware keys)

### No main process changes
All layout logic runs in renderer process:
- No new IPC handlers required (layout state is localStorage-only)
- Future IPC contract (GET_WORKSPACE_PATH) reserved for workspace integration but NOT implemented in this spec
- Main process remains unchanged from 000-foundation-monorepo

### CSS architecture (Tailwind 4)
All layout styling uses Tailwind 4 tokens:
- Token definitions in `apps/electron-shell/src/renderer/index.css` (CSS variables)
- Components reference tokens via Tailwind classes (e.g., `bg-gray-900`, `text-blue-400`)
- No inline styles, no hardcoded colors
- Supports future theming via CSS variable overrides

## Contracts (api-contracts updates)

### New type: LayoutState
**File**: `packages/api-contracts/src/types/layout-state.ts`

```typescript
import { z } from 'zod';

/**
 * Zod schema for layout state persistence.
 * Defines panel sizes and collapsed states for the shell layout.
 */
export const LayoutStateSchema = z.object({
  primarySidebarWidth: z.number().int().min(200).max(600).default(300),
  secondarySidebarWidth: z.number().int().min(200).max(600).default(300),
  bottomPanelHeight: z.number().int().min(100).max(600).default(200),
  primarySidebarCollapsed: z.boolean().default(false),
  secondarySidebarCollapsed: z.boolean().default(true),
  bottomPanelCollapsed: z.boolean().default(false),
  activeActivityBarIcon: z.enum(['explorer', 'search', 'source-control', 'run-debug', 'extensions', 'settings']).default('explorer'),
});

/**
 * TypeScript type inferred from LayoutStateSchema.
 * Used for localStorage persistence and React state.
 */
export type LayoutState = z.infer<typeof LayoutStateSchema>;

/**
 * Default layout state for new workspaces or reset.
 */
export const DEFAULT_LAYOUT_STATE: LayoutState = LayoutStateSchema.parse({});
```

**Export**: Add `export * from './types/layout-state';` to `packages/api-contracts/src/index.ts`

### Reserved IPC channel (not implemented yet)
**File**: `packages/api-contracts/src/ipc-channels.ts`

```typescript
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
  // Reserved for future workspace integration (spec 015+):
  // GET_WORKSPACE_PATH: 'workspace:get-path',
} as const;
```

**No PreloadAPI changes** in this spec (workspace integration is future work).

## IPC + process boundaries

### No new IPC communication
Layout state management is **entirely renderer-side**:
- **Storage**: localStorage (browser API, no Node.js/OS access required)
- **Scope**: Keyed by workspace path (for now, use "global" key since workspace integration is future)
- **Security**: localStorage is sandboxed per origin, no privilege escalation risk

### Process isolation compliance (P1)
- **Renderer**: Runs all layout logic (React state, drag handlers, localStorage I/O)
- **Main**: No layout-related code (unchanged from 000-foundation-monorepo)
- **Preload**: No new methods exposed to window.api
- **Verification**: `typeof process` in renderer DevTools returns `undefined` ✓

### Future IPC boundary (out of scope)
When workspace integration is added (spec 015+):
1. Renderer calls `window.api.getWorkspacePath()` → returns `Promise<string | null>`
2. Renderer uses workspace path as localStorage key suffix (e.g., `layout-state:/path/to/workspace`)
3. Main process handler reads workspace path from internal state (no file system access needed)

## UI components and routes

### packages/ui-kit components
All components are **pure React** (no Electron dependencies):

#### 1. ShellLayout (root container)
**Props**:
```typescript
interface ShellLayoutProps {
  activityBar: React.ReactNode;
  primarySidebar: React.ReactNode;
  editorArea: React.ReactNode;
  secondarySidebar: React.ReactNode;
  bottomPanel: React.ReactNode;
  statusBar: React.ReactNode;
  layoutState: LayoutState;
  onLayoutChange: (newState: Partial<LayoutState>) => void;
}
```
**Responsibilities**:
- CSS Grid layout with 6 regions
- Handles window resize (responsive behavior)
- No state management (controlled component)

#### 2. ResizablePanel
**Props**:
```typescript
interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  size: number; // px
  minSize: number;
  maxSize: number;
  collapsed: boolean;
  onResize: (newSize: number) => void;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}
```
**Responsibilities**:
- Renders drag handle with `onMouseDown` handler
- Tracks drag state with `mousemove`/`mouseup` listeners
- Emits `onResize` during drag, `onToggleCollapse` on button click
- Uses `React.memo` to prevent unnecessary re-renders

#### 3. ActivityBar
**Props**:
```typescript
interface ActivityBarProps {
  activeIcon: string;
  onIconClick: (icon: string) => void;
}
```
**Responsibilities**:
- Renders vertical icon list (6 placeholder icons: Explorer, Search, Source Control, Run & Debug, Extensions, Settings)
- Highlights active icon with `bg-blue-600`
- Emits `onIconClick` with icon ID

#### 4. StatusBar
**Props**:
```typescript
interface StatusBarProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}
```
**Responsibilities**:
- Fixed-height bar at bottom
- Two-section layout (left: workspace name, right: status items)
- Uses `bg-blue-900` background

#### 5. PanelHeader
**Props**:
```typescript
interface PanelHeaderProps {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```
**Responsibilities**:
- Renders panel title + collapse/expand button
- Used by Primary Sidebar, Secondary Sidebar, Bottom Panel

### apps/electron-shell/src/renderer components

#### 1. App.tsx (orchestrator)
**Responsibilities**:
- Wraps app in `<LayoutProvider>` (context for layout state)
- Renders `<ShellLayout>` with placeholder content for all 6 regions
- No business logic (delegates to LayoutContext)

#### 2. components/layout/ExplorerPanel.tsx (placeholder)
```typescript
export function ExplorerPanel() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <p>No folder open</p>
    </div>
  );
}
```

#### 3. components/layout/EditorPlaceholder.tsx
```typescript
export function EditorPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <p>Open a file to start editing</p>
    </div>
  );
}
```

#### 4. components/layout/TerminalPanel.tsx (placeholder)
```typescript
export function TerminalPanel() {
  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">Terminal</div>
      <div className="text-gray-400">No terminal sessions</div>
    </div>
  );
}
```

### No routing changes
Layout is NOT route-based (single-page shell):
- All 6 regions are always rendered (collapsed panels are hidden via CSS)
- Future route-based editor tabs will render inside Editor Area (spec 030+)

## Data model changes

### Renderer-side state model

#### 1. React Context: LayoutContext
**File**: `apps/electron-shell/src/renderer/contexts/LayoutContext.tsx`

**Context shape**:
```typescript
interface LayoutContextValue {
  state: LayoutState;
  updatePrimarySidebarWidth: (width: number) => void;
  updateSecondarySidebarWidth: (width: number) => void;
  updateBottomPanelHeight: (height: number) => void;
  togglePrimarySidebar: () => void;
  toggleSecondarySidebar: () => void;
  toggleBottomPanel: () => void;
  setActiveActivityBarIcon: (icon: string) => void;
  resetLayout: () => void;
}
```

**Context splitting** (for performance):
- Separate contexts for independent state slices (e.g., `PrimarySidebarContext`, `BottomPanelContext`)
- Prevents re-renders when unrelated panels change
- Compose contexts in `<LayoutProvider>`

#### 2. Custom hook: useLayoutState
**File**: `apps/electron-shell/src/renderer/hooks/useLayoutState.ts`

**Responsibilities**:
- Reads layout state from localStorage on mount (with Zod validation)
- Writes layout state to localStorage on change (debounced 200ms)
- Returns `[state, setState]` tuple (like `useState`)
- Handles validation errors by resetting to default state

**localStorage key format**:
- For now: `"ai-shell:layout-state:global"` (no workspace integration)
- Future: `"ai-shell:layout-state:/path/to/workspace"`

### No database changes
All state is ephemeral (localStorage only):
- No SQLite, no IndexedDB
- No server-side storage
- No sync across devices (future enhancement)

## Failure modes + recovery

### 1. Corrupted localStorage
**Symptom**: Layout state fails Zod validation (e.g., corrupted JSON)
**Recovery**:
- `useLayoutState` hook catches validation error
- Logs warning to console: `"Invalid layout state, resetting to defaults"`
- Clears corrupted value from localStorage
- Returns `DEFAULT_LAYOUT_STATE`
- User sees default layout on next render

### 2. Panel resize below minimum
**Symptom**: User drags panel handle past minimum size constraint
**Recovery**:
- `ResizablePanel` clamps `newSize` to `[minSize, maxSize]` before emitting `onResize`
- Layout state never stores invalid sizes (enforced by Zod schema)
- No visual glitch (cursor stops at boundary)

### 3. Window resize breaks layout
**Symptom**: User shrinks window smaller than combined panel widths
**Recovery**:
- CSS Grid uses `minmax()` for flexible columns: `minmax(200px, auto)`
- Panels shrink proportionally until minimum widths are reached
- If window is too small, horizontal scrollbar appears (browser default)
- Layout state remains valid (no corruption)

### 4. Keyboard shortcut conflicts
**Symptom**: User presses Ctrl+B but browser intercepts (e.g., bookmark shortcut)
**Recovery**:
- `useEffect` registers keyboard listener with `event.preventDefault()`
- Prevents browser default behavior for Ctrl+B, Ctrl+J
- If listener fails to register, shortcuts don't work but UI remains functional (toggle buttons still work)

### 5. React rendering error in layout component
**Symptom**: Error thrown in `<ShellLayout>` or child component
**Recovery**:
- Add `<ErrorBoundary>` in `App.tsx` wrapping `<ShellLayout>`
- Fallback UI: "Layout failed to render. [Reset Layout]" button
- Reset button clears localStorage and reloads app
- Error logged to console for debugging

### 6. Performance degradation (dropped frames during resize)
**Symptom**: Drag operation runs below 60fps (detected via profiling)
**Recovery**:
- Use `requestAnimationFrame` for resize updates (not `setState` on every `mousemove`)
- Throttle state updates to max 60Hz
- If still slow: disable panel animations (set transition to `0ms`)
- Fallback: display warning in DevTools, suggest disabling animations in settings (future)

## Testing strategy

### Unit tests (packages/ui-kit)
**Tool**: Vitest + React Testing Library
**Coverage target**: 80% for all components

#### Test cases:
1. **ShellLayout**:
   - Renders all 6 regions with correct props
   - Calls `onLayoutChange` when child panels emit resize events
2. **ResizablePanel**:
   - Drag handle updates size on `mousemove`
   - Clamps size to `[minSize, maxSize]`
   - Toggle button emits `onToggleCollapse`
   - Collapsed state hides content (via `display: none`)
3. **ActivityBar**:
   - Renders 6 icons
   - Active icon has `bg-blue-600` class
   - Clicking icon calls `onIconClick` with correct ID
4. **StatusBar**:
   - Renders left and right content in correct sections
5. **PanelHeader**:
   - Displays title
   - Toggle button icon changes based on `collapsed` prop

**Run command**: `pnpm --filter packages-ui-kit test`

### Integration tests (apps/electron-shell)
**Tool**: Vitest + React Testing Library
**Coverage target**: 70% for renderer code

#### Test cases:
1. **LayoutContext**:
   - Provides default state on mount
   - Updates state on action calls (e.g., `togglePrimarySidebar`)
2. **useLayoutState hook**:
   - Reads from localStorage on mount
   - Writes to localStorage on state change (debounced)
   - Resets to default if localStorage value is invalid
3. **Keyboard shortcuts**:
   - Ctrl+B toggles primary sidebar
   - Ctrl+J toggles bottom panel
   - Ctrl+Shift+E sets active icon to 'explorer'

**Run command**: `pnpm --filter apps-electron-shell test`

### E2E tests (Playwright)
**Tool**: Playwright with Electron support
**File**: `test/e2e/shell-layout.spec.ts`

#### Test cases:
1. **Layout rendering**:
   - Launch app, verify all 6 regions are visible
   - Verify Activity Bar has 6 icons
   - Verify Status Bar displays "No Folder Open"
2. **Panel resizing**:
   - Drag Primary Sidebar handle right 100px
   - Verify sidebar width increases
   - Close/reopen app, verify width persisted
3. **Panel collapsing**:
   - Click Primary Sidebar toggle button, verify collapsed
   - Press Ctrl+B, verify expanded
   - Close/reopen app, verify state persisted
4. **Keyboard shortcuts**:
   - Press Ctrl+J, verify Bottom Panel collapses
   - Press Ctrl+J again, verify Bottom Panel expands
5. **Activity Bar interaction**:
   - Click Search icon, verify active state changes
   - Close/reopen app, verify active icon persisted

**Run command**: `pnpm test:e2e` (from root)

### Performance testing
**Tool**: Chrome DevTools Performance tab (manual)

#### Verification criteria:
1. **Initial render**: Open Performance tab, reload app, verify "Layout render" mark completes in <50ms
2. **Resize performance**: Record drag operation, verify no dropped frames (60fps)
3. **Memory footprint**: Take heap snapshot, verify layout-related objects use <5MB

**Run command**: Manual (no automated performance tests yet)

### Accessibility testing (future)
Deferred to future spec (a11y improvements):
- Keyboard navigation (Tab, Arrow keys)
- Screen reader support (ARIA labels)
- Focus management (focus trap in panels)

## Rollout / migration

### Zero migration needed
No existing users or data to migrate:
- 000-foundation-monorepo has no layout state (just placeholder App.tsx)
- localStorage starts empty (default state used on first launch)
- No breaking changes to existing IPC contracts (no layout-related IPC exists yet)

### Package dependency updates
**packages/ui-kit**:
- Add dependencies: `react@^18.2.0`, `react-dom@^18.2.0`
- Add devDependencies: `vite@^6.x`, `@vitejs/plugin-react@^4.x`, `vitest@^2.x`, `@testing-library/react@^14.x`
- Update scripts: `build` → Vite build, `typecheck` → tsc, `lint` → ESLint, `test` → Vitest

**apps/electron-shell**:
- Add dependency: `packages-ui-kit` (workspace:*)
- No external package changes (React, Tailwind already present)

### Turbo cache invalidation
After implementing this spec:
- Run `pnpm -r clean` to clear all build outputs
- Run `pnpm -r build` to rebuild with new ui-kit package
- Turborepo will cache ui-kit build for future incremental builds

### Documentation updates
1. Update `README.md`: Add screenshot of shell layout
2. Update `docs/architecture.md`: Add "Layout System" section describing LayoutContext and localStorage persistence
3. Update `CONTRIBUTING.md`: Add "Adding layout panels" guide with example code

## Risks + mitigations

### Risk 1: Performance degradation during resize
**Impact**: High (poor UX, violates 60fps requirement)
**Probability**: Medium (complex React state updates can cause jank)
**Mitigation**:
- Use `React.memo` on all layout components to prevent unnecessary re-renders
- Split LayoutContext into multiple contexts (one per panel) to isolate state changes
- Use `requestAnimationFrame` for drag updates instead of immediate `setState`
- Add performance monitoring in tests (fail build if resize drops below 55fps)
**Contingency**: If still slow, add "Reduced motion" setting to disable animations

### Risk 2: Browser compatibility issues with CSS Grid
**Impact**: Low (layout breaks in older Chromium versions)
**Probability**: Low (Electron uses modern Chromium)
**Mitigation**:
- Electron 33.3.1 uses Chromium 128, which has full CSS Grid support
- Test in DevTools with responsive mode (simulate different viewport sizes)
- Use CSS fallbacks: `display: flex` as fallback if Grid not supported (unlikely)
**Contingency**: None needed (Electron controls Chromium version)

### Risk 3: localStorage quota exceeded
**Impact**: Low (layout state fails to persist)
**Probability**: Very Low (layout state is ~200 bytes, quota is 5-10MB)
**Mitigation**:
- Monitor localStorage usage in tests (log size of serialized state)
- Zod schema enforces reasonable limits (panel sizes 100-600px)
- Add error handling in `useLayoutState` to catch `QuotaExceededError`
**Contingency**: If quota exceeded, clear old workspace states (keep only 10 most recent)

### Risk 4: Accessibility gaps (keyboard navigation, screen readers)
**Impact**: Medium (violates a11y best practices)
**Probability**: High (a11y not tested in this spec)
**Mitigation**:
- Add TODO comments in code: "// TODO: Add ARIA labels for screen readers"
- File follow-up task in specs/020-accessibility/ for comprehensive a11y audit
- Ensure keyboard shortcuts work (Ctrl+B, Ctrl+J) — minimal keyboard support
**Contingency**: Add basic ARIA roles (`role="navigation"`, `role="main"`) now, full a11y in future spec

### Risk 5: State synchronization race conditions
**Impact**: Medium (conflicting state updates from multiple events)
**Probability**: Low (single-threaded React updates)
**Mitigation**:
- Use functional state updates: `setState(prev => ({ ...prev, ... }))`
- Debounce localStorage writes (200ms) to batch multiple rapid updates
- Avoid concurrent updates from multiple sources (all updates flow through LayoutContext)
**Contingency**: If race detected, add state version counter and reject stale updates

### Risk 6: Breaking changes to Tailwind 4 API
**Impact**: Medium (CSS classes need refactoring)
**Probability**: Low (Tailwind 4 is stable RC)
**Mitigation**:
- Pin Tailwind version in package.json: `@tailwindcss/vite@4.0.0-rc.x`
- Test with current Tailwind 4 RC (already in 000-foundation-monorepo)
- Avoid using experimental Tailwind features (stick to stable classes)
**Contingency**: If Tailwind 4 final release has breaking changes, run codemod to update classes

## Done definition

### Code complete
- [ ] packages/ui-kit package has 5 React components (ShellLayout, ResizablePanel, ActivityBar, StatusBar, PanelHeader)
- [ ] packages/ui-kit exports all components via index.ts with TypeScript types
- [ ] packages/ui-kit has unit tests with 80%+ coverage
- [ ] apps/electron-shell/src/renderer has LayoutContext, useLayoutState hook, and 3 placeholder panel components
- [ ] apps/electron-shell/src/renderer/App.tsx renders ShellLayout with all 6 regions
- [ ] packages/api-contracts has LayoutStateSchema with Zod validation

### Verification passing
- [ ] `pnpm -r typecheck` — 0 TypeScript errors
- [ ] `pnpm -r lint` — 0 ESLint errors
- [ ] `pnpm -r test` — All unit tests pass (ui-kit + electron-shell)
- [ ] `pnpm -r build` — Clean build with no warnings
- [ ] `pnpm test:e2e` — All 5 E2E tests pass (rendering, resizing, collapsing, shortcuts, persistence)

### Manual verification
- [ ] Launch app (`pnpm dev`), verify all 6 layout regions render
- [ ] Drag Primary Sidebar handle, verify smooth resize at 60fps
- [ ] Press Ctrl+B, verify sidebar collapses/expands
- [ ] Press Ctrl+J, verify bottom panel collapses/expands
- [ ] Click Activity Bar icons, verify active state changes
- [ ] Close app, reopen, verify layout state persisted (panel sizes + collapsed states)
- [ ] Open Chrome DevTools, verify `typeof process === "undefined"` in console (sandboxing intact)
- [ ] Clear localStorage, reload app, verify default layout renders

### Documentation complete
- [ ] README.md updated with shell layout screenshot and feature list
- [ ] docs/architecture.md has new "Layout System" section
- [ ] CONTRIBUTING.md has "Adding layout panels" guide
- [ ] All ui-kit components have TSDoc comments with usage examples

### Performance verified
- [ ] Chrome DevTools Performance tab shows initial layout render <50ms
- [ ] Drag resize operation maintains 60fps (no dropped frames in Performance timeline)
- [ ] Layout state localStorage read/write completes in <10ms (verify in Network tab)
- [ ] Bundle size increase is ≤50KB (check dist/ folder size before/after)

### Security verified
- [ ] Renderer DevTools console: `typeof process` returns `"undefined"` ✓
- [ ] Renderer DevTools console: `typeof require` returns `"undefined"` ✓
- [ ] Layout state in localStorage contains no sensitive data (inspect Application → Local Storage)
- [ ] No IPC handlers added to main process (verify src/main/ipc-handlers.ts unchanged)

### Acceptance criteria met
All 20 acceptance criteria from spec.md verified:
- [ ] Criteria 1-17: Functional requirements (rendering, resizing, collapsing, persistence, styling)
- [ ] Criteria 18-19: Build verification (typecheck, lint)
- [ ] Criteria 20: E2E test coverage
