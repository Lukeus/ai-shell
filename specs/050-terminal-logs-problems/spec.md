# 050 Terminal + Logs + Problems

## Problem / Why

The bottom panel is currently a placeholder that displays only a static "No terminal sessions" message. To become a functional IDE shell, we need to implement three critical views in the bottom panel: an interactive terminal (xterm.js), a logs/output viewer, and a problems/diagnostics list. These views are essential for developers to run shell commands, monitor application output, and view code issues (linting, TypeScript errors, build failures).

Without these features:
- Users cannot execute shell commands within the IDE
- Build output, test results, and application logs are invisible
- TypeScript errors, ESLint warnings, and other diagnostics are not surfaced
- The bottom panel remains non-functional, reducing IDE utility

This spec focuses on the bottom panel infrastructure and three core views that align with the VS Code-like layout established in spec 010-shell-layout.

## Goals

- Implement interactive terminal using xterm.js with proper PTY integration via main process
- Create logs/output viewer to display build output, test results, and application logs
- Build problems/diagnostics list to surface TypeScript errors, ESLint warnings, and other issues
- Support multiple terminal sessions with tab management (new, close, rename)
- Enable tab switching between Terminal, Output, and Problems views in bottom panel
- Persist terminal sessions and view state across app restarts
- Define IPC contracts in `packages/api-contracts` for terminal PTY operations
- Lazy-load xterm.js to avoid impacting initial bundle size (following Monaco pattern from 040)
- Ensure all terminal operations respect process isolation (PTY in main, UI in renderer)
- Support terminal themes that integrate with Tailwind 4 design system

## Non-goals

- Terminal split views or multiple terminals in grid layout (future enhancement)
- Custom shell integration (prompt injection, semantic commands) (future enhancement)
- Problems panel auto-fix actions or quick fixes (separate extension feature)
- Log filtering, search, or regex highlighting (future enhancement)
- Terminal session persistence across system restarts (future enhancement)
- Multi-root workspace support for problems aggregation (future enhancement)
- Output channels from extensions (extension API feature, separate spec)
- Terminal link detection and navigation (future enhancement)
- Problems panel severity filtering or grouping by file (future enhancement)

## User stories

**As a user**, I want to open an integrated terminal, so I can run shell commands without leaving the IDE.

**As a user**, I want to create multiple terminal sessions with tabs, so I can run different tasks simultaneously (e.g., dev server in one, tests in another).

**As a user**, I want to view build output and test results in the Output view, so I can diagnose failures without checking external logs.

**As a user**, I want to see TypeScript errors and ESLint warnings in the Problems view, so I can quickly identify and fix code issues.

**As a user**, I want to switch between Terminal, Output, and Problems tabs, so I can access the view I need for my current task.

**As a user**, I want terminal tabs to persist when I close and reopen the app, so I don't lose my working sessions.

**As a developer**, I want terminal operations to respect process isolation, so the architecture remains secure and maintainable.

## UX requirements

### Bottom Panel Structure

1. **Tab Bar** (top of bottom panel):
   - Tabs: "Terminal", "Output", "Problems"
   - Active tab highlighted with accent color
   - Tab icons: terminal icon, log icon, warning/error icon
   - New terminal button (+ icon) visible when Terminal tab is active
   - Close button (x) on terminal session tabs (not on Output/Problems tabs)

2. **Terminal View**:
   - Default tab: "bash" or "pwsh" (depending on platform)
   - Terminal sessions displayed as sub-tabs under main Terminal tab
   - Sub-tab format: "bash", "pwsh #2", "Custom Name"
   - Double-click sub-tab to rename session
   - Right-click context menu: Rename, Close, Close Others, Close All
   - Empty state: "No terminal sessions. Click + to create one."
   - Terminal content: xterm.js canvas with scrollback (1000 lines default)

3. **Output View**:
   - Read-only text viewer with line numbers (optional toggle)
   - Auto-scroll to bottom when new content arrives (with manual override)
   - Channel dropdown: "Build", "Test", "Extension Host", "Agent Host" (placeholder channels for now)
   - Clear output button (trash icon)
   - Copy all button (clipboard icon)
   - Empty state: "No output available. Output will appear here from build tasks and extensions."

4. **Problems View**:
   - Table layout: Icon | Message | File | Line | Source
   - Icon: error (red), warning (yellow), info (blue)
   - Message: diagnostic text (truncated with ellipsis, full text on hover)
   - File: relative path from workspace root (clickable to open file)
   - Line: line number (clickable to navigate to line in editor)
   - Source: "TypeScript", "ESLint", etc.
   - Summary header: "3 errors, 5 warnings, 2 infos"
   - Empty state: "No problems detected. Good work!"

### Interaction

- Click Terminal tab → show terminal sessions and sub-tabs
- Click + button → create new terminal session (use default shell)
- Click terminal sub-tab → switch to that session
- Type in terminal → input sent to PTY, output rendered in xterm
- Ctrl+C in terminal → sends SIGINT to PTY process
- Click Output tab → show output viewer with channel dropdown
- Click Problems tab → show diagnostics table
- Click file path in Problems → open file in editor area (future integration)
- Click line number in Problems → navigate to line in editor (future integration)

## Functional requirements

### IPC Contracts (packages/api-contracts)

Define Zod schemas for:

1. **Terminal PTY**:
   ```typescript
   // Request: create new terminal session
   IPC_CHANNELS.TERMINAL_CREATE = 'terminal:create'
   // Payload: { shell?: string, cwd?: string, env?: Record<string, string> }
   // Response: { sessionId: string }

   // Request: write data to terminal (user input)
   IPC_CHANNELS.TERMINAL_WRITE = 'terminal:write'
   // Payload: { sessionId: string, data: string }

   // Event: receive data from terminal (output)
   IPC_CHANNELS.TERMINAL_DATA = 'terminal:data'
   // Payload: { sessionId: string, data: string }

   // Request: resize terminal dimensions
   IPC_CHANNELS.TERMINAL_RESIZE = 'terminal:resize'
   // Payload: { sessionId: string, cols: number, rows: number }

   // Request: close terminal session
   IPC_CHANNELS.TERMINAL_CLOSE = 'terminal:close'
   // Payload: { sessionId: string }

   // Event: terminal session exited
   IPC_CHANNELS.TERMINAL_EXIT = 'terminal:exit'
   // Payload: { sessionId: string, exitCode: number }
   ```

2. **Output Channels**:
   ```typescript
   // Event: append to output channel
   IPC_CHANNELS.OUTPUT_APPEND = 'output:append'
   // Payload: { channel: string, text: string }

   // Request: clear output channel
   IPC_CHANNELS.OUTPUT_CLEAR = 'output:clear'
   // Payload: { channel: string }
   ```

3. **Problems/Diagnostics**:
   ```typescript
   // Event: update diagnostics for file
   IPC_CHANNELS.DIAGNOSTICS_UPDATE = 'diagnostics:update'
   // Payload: { uri: string, diagnostics: Diagnostic[] }
   
   interface Diagnostic {
     severity: 'error' | 'warning' | 'info' | 'hint';
     message: string;
     line: number;
     column: number;
     source: string; // 'TypeScript', 'ESLint', etc.
   }

   // Request: clear all diagnostics
   IPC_CHANNELS.DIAGNOSTICS_CLEAR = 'diagnostics:clear'
   ```

### Main Process (Shell Kernel)

1. **Terminal PTY Manager** (`packages/shell-kernel/src/terminal/pty-manager.ts`):
   - Create PTY sessions using `node-pty` library
   - Manage session lifecycle (create, write, resize, close)
   - Forward PTY output to renderer via IPC events
   - Handle PTY exit events and cleanup
   - Respect user's default shell from environment (SHELL on Unix, COMSPEC on Windows)

2. **Security**:
   - Validate all terminal IPC requests (session IDs, data sanitization)
   - Restrict terminal access to workspace directory (no arbitrary cwd outside workspace)
   - Do NOT log terminal input/output (may contain secrets)
   - Limit number of concurrent terminal sessions (max 10)

### Renderer Process

1. **Lazy-load xterm.js** (following Monaco pattern):
   - Dynamic import xterm.js when Terminal tab is first activated
   - Show loading spinner: "Loading terminal..."
   - Bundle xterm.js and addons (xterm-addon-fit, xterm-addon-webgl) in separate chunk
   - Verify xterm is excluded from initial bundle via build analysis

2. **Terminal Component** (`apps/electron-shell/src/renderer/components/terminal/Terminal.tsx`):
   - Render xterm.js terminal instance
   - Send user input to main via IPC_CHANNELS.TERMINAL_WRITE
   - Receive output from main via IPC_CHANNELS.TERMINAL_DATA and write to xterm
   - Handle resize events (fit addon) and send to main via IPC_CHANNELS.TERMINAL_RESIZE
   - Handle session exit events and display exit code

3. **Terminal Manager** (`apps/electron-shell/src/renderer/contexts/TerminalContext.tsx`):
   - Track active terminal sessions (array of { sessionId, name, isActive })
   - Handle new terminal creation, tab switching, renaming, closing
   - Persist session metadata to localStorage (session IDs, names, active tab)
   - Restore sessions on app relaunch (re-create PTY in main)

4. **Output Component** (`apps/electron-shell/src/renderer/components/output/OutputViewer.tsx`):
   - Render read-only text viewer (virtualized list for performance)
   - Subscribe to IPC_CHANNELS.OUTPUT_APPEND events
   - Implement channel switching via dropdown
   - Auto-scroll to bottom (with user override detection)

5. **Problems Component** (`apps/electron-shell/src/renderer/components/problems/ProblemsPanel.tsx`):
   - Render diagnostics table using `packages/ui-kit` table component
   - Subscribe to IPC_CHANNELS.DIAGNOSTICS_UPDATE events
   - Aggregate diagnostics from all sources (TypeScript, ESLint, etc.)
   - Sort by severity (errors first, then warnings, infos, hints)
   - Display summary counts in panel header

6. **Bottom Panel Tabs** (update `apps/electron-shell/src/renderer/components/layout/BottomPanel.tsx`):
   - Replace placeholder with tab bar: Terminal, Output, Problems
   - Render active view based on selected tab
   - Persist active tab to localStorage

### Component Structure (packages/ui-kit)

1. **`<TabBar>`**: Reusable tab navigation component
2. **`<Terminal>`**: xterm.js wrapper (renderer-only, no exports from ui-kit)
3. **`<OutputViewer>`**: Read-only virtualized text viewer
4. **`<ProblemsTable>`**: Diagnostics table with sortable columns

### Styling (Tailwind 4 Tokens)

- Terminal background: `bg-gray-950` (editor area background)
- Terminal foreground: `text-gray-100`
- Terminal cursor: `bg-blue-500`
- Tab bar: `bg-gray-800`, active tab `bg-gray-900` with `border-t-2 border-blue-500`
- Output viewer: `bg-gray-900`, line numbers `text-gray-600`
- Problems table: alternating row colors `bg-gray-800` / `bg-gray-850`
- Error icon: `text-red-500`, Warning icon: `text-yellow-500`, Info icon: `text-blue-500`

All colors must use Tailwind 4 tokens for future theming support.

## Security requirements

- **P1 Process Isolation**: PTY operations run ONLY in main process; renderer never accesses node-pty directly
- **P2 Security Defaults**: No changes to contextIsolation, sandbox, or nodeIntegration
- **P3 Secrets**: Terminal input/output is NEVER logged; no plaintext secrets in terminal state
- Terminal cwd is restricted to workspace directory or subdirectories (validate in main)
- Terminal environment variables are sanitized (no arbitrary env injection from renderer)
- Diagnostics do NOT include full file contents (only line/column references)
- Output viewer does NOT execute arbitrary code (no eval, no innerHTML with user content)
- Session IDs are validated on every IPC request to prevent session hijacking
- Terminal resize dimensions are validated (prevent memory exhaustion via huge terminal)

## Performance requirements

- **xterm.js Bundle Size**: xterm and addons excluded from initial bundle; lazy chunk <300KB gzipped
- **Terminal Render**: Terminal renders within 1 second after dynamic import completes
- **PTY Latency**: Terminal input to output latency <50ms (typical shell responsiveness)
- **Output Viewer**: Handles 10,000+ lines without jank using virtualization
- **Problems Panel**: Renders 1,000+ diagnostics without blocking UI (virtualized table)
- **Tab Switching**: Tab switch completes within 16ms (one frame, instant feedback)
- **Memory**: Each terminal session uses ≤10MB renderer heap (xterm instances)
- **Session Restoration**: Restoring 5 terminal sessions on app launch completes within 2 seconds

## Acceptance criteria

1. ✅ Bottom panel displays tab bar with Terminal, Output, and Problems tabs
2. ✅ Clicking Terminal tab shows terminal view with "+" button to create new session
3. ✅ Clicking "+" button creates new terminal session with platform default shell (bash/pwsh)
4. ✅ Terminal sessions display as sub-tabs under Terminal tab (e.g., "bash", "pwsh #2")
5. ✅ Typing in terminal sends input to PTY and displays output via xterm.js
6. ✅ Terminal supports Ctrl+C (SIGINT), basic shell commands (ls, cd, etc.), and scrollback
7. ✅ Terminal sessions can be renamed via double-click or context menu
8. ✅ Terminal sessions can be closed via close button (x) or context menu
9. ✅ xterm.js is lazy-loaded and excluded from initial renderer bundle (verified via build analysis)
10. ✅ Clicking Output tab shows output viewer with channel dropdown and clear button
11. ✅ Output viewer displays mock build output for "Build" channel (placeholder content)
12. ✅ Output viewer auto-scrolls to bottom when new content arrives
13. ✅ Clicking Problems tab shows diagnostics table with columns: Icon, Message, File, Line, Source
14. ✅ Problems panel displays mock TypeScript/ESLint diagnostics (placeholder content)
15. ✅ Problems panel summary header shows counts: "X errors, Y warnings, Z infos"
16. ✅ Active tab state persists to localStorage and restores on app relaunch
17. ✅ Terminal session metadata (IDs, names) persists and sessions are recreated on app relaunch
18. ✅ IPC contracts defined in `packages/api-contracts` with Zod schemas
19. ✅ PTY operations run in main process only (no Node access from renderer)
20. ✅ Terminal input/output is NOT logged anywhere (verified by code review)
21. ✅ TypeScript compiles with 0 errors (`pnpm -r typecheck`)
22. ✅ ESLint passes with 0 errors (`pnpm -r lint`)
23. ✅ Unit tests pass for Terminal, Output, Problems components (`pnpm -r test`)
24. ✅ Playwright E2E test verifies: create terminal, type command, see output, switch tabs, restore sessions

## Out of scope / Future work

- **Terminal Link Detection**: Clickable file paths, URLs in terminal output
- **Terminal Search**: Find in terminal output (Ctrl+F)
- **Terminal Split View**: Multiple terminals in grid layout
- **Custom Shell Integration**: Prompt injection, command decorations, semantic commands
- **Problems Auto-Fix**: Quick fix actions for diagnostics (extension API feature)
- **Output Filtering**: Regex search, log level filtering
- **Terminal Session Persistence**: Restore terminal state across system restarts (not just app restarts)
- **Extension Output Channels**: Extensions contributing custom output channels (extension API)
- **Multi-root Workspace**: Aggregate problems from multiple workspace folders
- **Terminal Profiles**: User-defined shell profiles with custom args/env
- **Terminal Context Menu**: Copy, paste, select all (future enhancement)
- **Terminal Color Themes**: Custom xterm color schemes beyond default

## Open questions

- Should we use `node-pty` or `node-pty-prebuilt` for cross-platform PTY support?
- What's the default terminal scrollback buffer size? (1000 lines? 10,000 lines?)
- Should terminal sessions be fully restored (with command history) or just recreated (empty)?
- Do we need to support Windows ConPTY vs legacy Windows console?
- Should Output and Problems views be read-only forever, or do we need edit capabilities later?
- How do we handle terminal sessions when workspace is closed? (keep alive? close all?)
