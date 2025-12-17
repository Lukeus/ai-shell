# 010-shell-layout

## Problem / Why

The ai-shell foundation (000-foundation-monorepo) provides a working Electron app with React and Tailwind, but currently displays a simple centered layout. To become a functional IDE shell, we need to implement a VS Code-like multi-panel layout with: Activity Bar, Primary Sidebar, Editor Area, Secondary Sidebar, Bottom Panel, and Status Bar. This layout must support resizable panels, collapsible regions, drag-to-reorder capabilities, and persist user layout preferences per workspace. Without this foundational layout system, subsequent features (Monaco editor, terminal, extensions UI) will have no structure to integrate into.

## Goals

- Implement VS Code-like multi-region layout with six distinct areas (Activity Bar, Primary Sidebar, Editor Area, Secondary Sidebar, Bottom Panel, Status Bar)
- Support resizable panels with drag handles and collapsible regions
- Persist layout state (panel sizes, collapsed states, active views) per workspace
- Provide keyboard shortcuts for toggling panels (e.g., Ctrl+B for sidebar, Ctrl+J for bottom panel)
- Enable responsive layout that adapts to window resize while maintaining user preferences
- Create reusable layout components in `packages/ui-kit` for consistent patterns
- Establish Tailwind 4 token-based theming for all layout components
- Ensure layout components respect process isolation (no Node.js access from renderer)

## Non-goals

- Monaco editor integration (handled in separate spec: 020-monaco-lazy-load)
- Terminal implementation (handled in separate spec)
- Extension UI content or panels (handled in extension specs)
- Full settings UI implementation (settings panel content is future work)
- Drag-and-drop for files or editor tabs (future enhancement)
- Multiple window support or detached panels (future enhancement)
- Theme switcher UI (theming system is separate spec)
- Activity Bar icon registration system (extension integration is future)

## User stories

**As a user**, I want to see a familiar IDE layout with sidebar, editor area, and bottom panel, so I can quickly orient myself and start working.

**As a user**, I want to resize panels by dragging dividers, so I can allocate screen space according to my workflow.

**As a user**, I want to collapse and expand sidebars with keyboard shortcuts, so I can maximize editor space when needed.

**As a user**, I want my panel sizes and collapsed states to persist when I close and reopen the app, so I don't have to reconfigure my layout every session.

**As a user**, I want to toggle the bottom panel visibility with Ctrl+J, so I can quickly show/hide terminal or logs.

**As a developer**, I want layout components to be reusable and documented, so I can add new panels or views consistently.

## UX requirements

### Layout Regions

1. **Activity Bar** (leftmost, ~48px wide):
   - Vertical icon bar
   - Icons: Explorer, Search, Source Control, Run & Debug, Extensions, Settings (placeholder icons for now)
   - Active icon has accent color/indicator
   - Fixed width, always visible

2. **Primary Sidebar** (left, 200-600px default 300px):
   - Collapsible via toggle button or Ctrl+B
   - Displays content based on active Activity Bar icon
   - For this spec: show placeholder "Explorer" view with "No folder open" message
   - Resizable via drag handle on right edge

3. **Editor Area** (center, flexible):
   - Main content area (for now: placeholder "Open a file to start editing" message)
   - Takes all remaining horizontal space
   - Background: editor theme background color

4. **Secondary Sidebar** (right, 200-600px default 300px):
   - Collapsible via toggle button
   - For this spec: hidden by default, shows placeholder "AI Assistant" view when open
   - Resizable via drag handle on left edge

5. **Bottom Panel** (bottom, 100-600px default 200px):
   - Collapsible via toggle button or Ctrl+J
   - For this spec: show placeholder "Terminal" tab header with "No terminal sessions" message
   - Resizable via drag handle on top edge

6. **Status Bar** (bottom, ~24px high):
   - Fixed height, always visible
   - Left section: workspace name or "No Folder Open"
   - Right section: placeholder for line/col, language, notifications
   - Background: distinct from other panels

### Interaction

- Drag handles: 4px wide/tall, visible on hover, change cursor to `resize` pointer
- Collapsed panels: stored in layout state, show expand button/icon at edge
- Keyboard shortcuts:
  - `Ctrl+B` (Cmd+B on Mac): Toggle Primary Sidebar
  - `Ctrl+J` (Cmd+J on Mac): Toggle Bottom Panel
  - `Ctrl+Shift+E` (Cmd+Shift+E on Mac): Focus Explorer (Activity Bar icon)
- Responsive: minimum panel widths (200px for sidebars, 100px for bottom panel), prevent panels from shrinking below minimum

## Functional requirements

### Layout State Management

1. **State Schema** (define in `packages/api-contracts`):
   ```typescript
   interface LayoutState {
     primarySidebarWidth: number; // px
     secondarySidebarWidth: number; // px
     bottomPanelHeight: number; // px
     primarySidebarCollapsed: boolean;
     secondarySidebarCollapsed: boolean;
     bottomPanelCollapsed: boolean;
     activeActivityBarIcon: string; // 'explorer' | 'search' | etc.
   }
   ```

2. **Persistence**:
   - Store layout state in localStorage (renderer-side for now)
   - Scope: per workspace (if no workspace, use "global" key)
   - Restore on app launch
   - Reset Layout command clears stored state and restores defaults

3. **IPC Contract** (for future workspace integration):
   - `IPC_CHANNELS.GET_WORKSPACE_PATH`: returns current workspace path (null if no folder open)
   - Layout component uses workspace path as storage key

### Component Structure

1. **`packages/ui-kit` components**:
   - `<ShellLayout>`: Root layout container with six regions as props
   - `<ResizablePanel>`: Wrapper for resizable regions (sidebar, bottom panel)
   - `<ActivityBar>`: Left icon bar with click handlers
   - `<StatusBar>`: Bottom status bar with left/right sections
   - `<PanelHeader>`: Reusable header for sidebars/bottom panel with collapse/expand button

2. **`apps/electron-shell/src/renderer` structure**:
   - `App.tsx`: Orchestrates `<ShellLayout>` with state management
   - `components/layout/`: Layout-specific components
   - `hooks/useLayoutState.ts`: Custom hook for layout persistence
   - `contexts/LayoutContext.tsx`: React context for layout state

### Styling (Tailwind 4 Tokens)

- Background colors:
  - Activity Bar: `bg-gray-900`
  - Sidebar: `bg-gray-800`
  - Editor Area: `bg-gray-950`
  - Bottom Panel: `bg-gray-800`
  - Status Bar: `bg-blue-900`
- Text: `text-white`, `text-gray-300`, `text-gray-400`
- Borders: `border-gray-700`
- Drag handles: `hover:bg-blue-500/20` (accent color with opacity)
- Active states: `bg-blue-600`, `text-blue-400`

All colors must use Tailwind 4 tokens for future theming support.

## Security requirements

- Layout state stored in renderer localStorage (no secrets or sensitive data)
- No direct IPC to main process for layout state (localStorage only for this spec)
- Panel resize logic runs entirely in renderer (no OS-level dependencies)
- Activity Bar click handlers do not execute arbitrary code (only trigger React state updates)
- Keyboard shortcut handlers registered in renderer only (no global OS shortcuts in this spec)
- No external CSS injection from localStorage (sanitize/validate stored layout state)
- Respect **P1 (Process Isolation)**: Layout components run in sandboxed renderer with no Node.js access
- Respect **P2 (Security Defaults)**: No changes to contextIsolation, sandbox, or nodeIntegration settings

## Performance requirements

- **Layout Render**: Initial layout render completes within 50ms (measured from App mount to layout paint)
- **Panel Resize**: Drag operations maintain 60fps (no jank during resize)
- **Collapse/Expand**: Panel animations complete within 200ms
- **State Persistence**: Reading/writing layout state to localStorage completes within 10ms
- **Keyboard Shortcuts**: Shortcut handlers execute within 16ms (one frame)
- **Bundle Size Impact**: Layout components add ≤ 50KB to initial renderer bundle
- **Memory Footprint**: Layout state and event listeners use ≤ 5MB additional memory
- **Rerender Optimization**: Resizing one panel does not trigger re-renders of unrelated components (use React.memo and context splitting)

## Acceptance criteria

1. ✅ Six distinct layout regions render correctly: Activity Bar, Primary Sidebar, Editor Area, Secondary Sidebar, Bottom Panel, Status Bar
2. ✅ Primary Sidebar is resizable via drag handle (min 200px, max 600px, default 300px)
3. ✅ Secondary Sidebar is resizable via drag handle (min 200px, max 600px, default 300px)
4. ✅ Bottom Panel is resizable via drag handle (min 100px, max 600px, default 200px)
5. ✅ Primary Sidebar collapses/expands via toggle button or Ctrl+B keyboard shortcut
6. ✅ Bottom Panel collapses/expands via toggle button or Ctrl+J keyboard shortcut
7. ✅ Secondary Sidebar collapses/expands via toggle button
8. ✅ Layout state (panel sizes and collapsed states) persists to localStorage on change
9. ✅ Layout state restores correctly on app relaunch (verified by closing/reopening)
10. ✅ Activity Bar icons highlight active state (Explorer icon active by default)
11. ✅ Clicking Activity Bar icons updates active state (visual only for now, no panel content changes)
12. ✅ Status Bar displays "No Folder Open" in left section and placeholder info in right section
13. ✅ Drag handles are visible on hover and cursor changes to resize pointer
14. ✅ Panel widths/heights do not shrink below minimum values during resize
15. ✅ All layout components use Tailwind 4 tokens (no hardcoded colors)
16. ✅ Layout components are exported from `packages/ui-kit` and documented
17. ✅ Resize operations maintain 60fps (no dropped frames during drag)
18. ✅ TypeScript compiles with 0 errors (`pnpm -r typecheck`)
19. ✅ ESLint passes with 0 errors (`pnpm -r lint`)
20. ✅ Playwright E2E test verifies: layout renders, panels resize, state persists

## Out of scope / Future work

- **Monaco Editor Integration**: Editor Area will display Monaco in spec 020-monaco-lazy-load
- **Terminal Implementation**: Bottom Panel will contain functional terminal in separate spec
- **Extensions UI**: Activity Bar icon registration and extension-contributed views (future spec)
- **Settings UI**: Full settings panel with search, categories, and JSON editor (separate spec)
- **Drag-to-Reorder**: Activity Bar icons, sidebar views, and bottom panel tabs (future enhancement)
- **Multiple Workspaces**: Workspace switcher and per-workspace layout isolation (future spec)
- **Panel Detachment**: Floating or multi-window panels (future enhancement)
- **Minimap**: Editor minimap in right gutter (part of Monaco spec)
- **Breadcrumbs**: File path breadcrumbs above editor (part of Monaco spec)
- **Tab Management**: Editor tabs, split panes, tab groups (separate spec)
- **Theme Switcher**: UI for changing themes (part of theming spec)
- **Custom Panels**: Extension API for registering custom panels (extension spec)

## Open questions

1. Should layout state be scoped by workspace path or workspace ID? (Answer: workspace path for simplicity)
2. Should we implement smooth collapse/expand animations, or instant toggle? (Answer: 200ms transition for better UX)
3. Should Activity Bar support drag-to-reorder in this spec? (Answer: No, deferred to future enhancement)
4. Should Status Bar be clickable/interactive (e.g., open settings on click)? (Answer: No, status display only for this spec)
5. Should we support custom minimum/maximum panel sizes via settings? (Answer: No, use fixed constraints for consistency)
6. Should Secondary Sidebar be visible by default or hidden? (Answer: Hidden by default, user can enable)
7. Should we add a "Reset Layout" command in this spec? (Answer: Yes, clear localStorage and reload)
8. Should keyboard shortcuts be configurable? (Answer: No, hardcoded for this spec, keybindings system is future work)
