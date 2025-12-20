# 050 Terminal + Logs + Problems — Technical Plan

## Architecture changes

### Process boundaries (P1: Process Isolation)
This feature introduces **new OS-level operations** that must respect process isolation:

**Main Process (apps/electron-shell/src/main):**
- **NEW: Terminal PTY Manager** (`services/TerminalService.ts`)
  - Uses `node-pty` library to spawn PTY processes (bash, pwsh, etc.)
  - Manages session lifecycle: create, write, resize, close
  - Forwards PTY stdout/stderr to renderer via IPC events
  - Handles PTY exit events and cleanup
  - **Security:** Validates session IDs, restricts cwd to workspace, limits concurrent sessions (max 10)
  - **NO LOGGING:** Terminal I/O contains secrets and must NEVER be logged

**Renderer Process (apps/electron-shell/src/renderer):**
- **NEW: Terminal UI** (`components/terminal/`)
  - Lazy-loads xterm.js via dynamic import (following Monaco pattern from 040)
  - Renders xterm.js canvas for each terminal session
  - Sends user input to main via IPC (TERMINAL_WRITE)
  - Receives PTY output from main via IPC events (TERMINAL_DATA)
  - **NO NODE ACCESS:** xterm.js runs in sandboxed renderer; all PTY operations via IPC

- **NEW: Output Viewer** (`components/output/`)
  - Read-only virtualized text viewer for logs (Build, Test, Extension Host, Agent Host)
  - Subscribes to IPC events (OUTPUT_APPEND) from main process
  - No OS access; purely UI rendering

- **NEW: Problems Panel** (`components/problems/`)
  - Table view for diagnostics (TypeScript errors, ESLint warnings, etc.)
  - Subscribes to IPC events (DIAGNOSTICS_UPDATE) from main process
  - Aggregates and sorts diagnostics by severity

- **UPDATED: Bottom Panel** (`components/layout/BottomPanel.tsx`)
  - Replace placeholder with tab bar (Terminal, Output, Problems)
  - Tab switching logic with persistence to localStorage

### Dependency additions
**Main process (apps/electron-shell/package.json):**
- `node-pty@^1.0.0` — PTY bindings for terminal emulation (requires native compilation)

**Renderer process (apps/electron-shell/package.json):**
- `xterm@^5.5.0` — Terminal emulator core
- `xterm-addon-fit@^0.10.0` — Auto-resize addon
- `xterm-addon-webgl@^0.18.0` — WebGL renderer for performance (optional)

**UI-kit (packages/ui-kit/package.json):**
- `@tanstack/react-virtual@^3.10.0` — Virtualized list for Output/Problems (handles 10K+ items)

### Bundle strategy (P5: Performance Budgets)
- **Initial renderer bundle:** MUST NOT include xterm.js (currently ~300KB minified)
- **Lazy chunk:** `terminal-<hash>.js` loaded on first Terminal tab activation
- **Verification:** Build analysis must confirm xterm.js in separate chunk

## Contracts (api-contracts updates)

**P6 (Contracts-first):** Define ALL IPC contracts in `packages/api-contracts` BEFORE implementation.

### New file: `packages/api-contracts/src/types/terminal.ts`

```typescript
import { z } from 'zod';

/**
 * Terminal PTY session creation request.
 * Security: shell and cwd are validated in main process.
 */
export const TerminalCreateRequestSchema = z.object({
  /** Shell to use (optional, defaults to system shell: bash on Unix, pwsh on Windows) */
  shell: z.string().optional(),
  
  /** Working directory (optional, defaults to workspace root, MUST be within workspace) */
  cwd: z.string().optional(),
  
  /** Environment variables (optional, sanitized in main to prevent injection) */
  env: z.record(z.string(), z.string()).optional(),
});

export const TerminalCreateResponseSchema = z.object({
  /** Unique session ID (UUID) for this terminal session */
  sessionId: z.string().uuid(),
});

export const TerminalWriteRequestSchema = z.object({
  /** Session ID to write to */
  sessionId: z.string().uuid(),
  
  /** Data to write (user input, control sequences like Ctrl+C) */
  data: z.string(),
});

export const TerminalDataEventSchema = z.object({
  /** Session ID that produced output */
  sessionId: z.string().uuid(),
  
  /** Output data from PTY (stdout/stderr) */
  data: z.string(),
});

export const TerminalResizeRequestSchema = z.object({
  /** Session ID to resize */
  sessionId: z.string().uuid(),
  
  /** Number of columns (validated: 10-500) */
  cols: z.number().int().min(10).max(500),
  
  /** Number of rows (validated: 5-200) */
  rows: z.number().int().min(5).max(200),
});

export const TerminalCloseRequestSchema = z.object({
  /** Session ID to close */
  sessionId: z.string().uuid(),
});

export const TerminalExitEventSchema = z.object({
  /** Session ID that exited */
  sessionId: z.string().uuid(),
  
  /** Exit code from PTY process */
  exitCode: z.number().int(),
});

export type TerminalCreateRequest = z.infer<typeof TerminalCreateRequestSchema>;
export type TerminalCreateResponse = z.infer<typeof TerminalCreateResponseSchema>;
export type TerminalWriteRequest = z.infer<typeof TerminalWriteRequestSchema>;
export type TerminalDataEvent = z.infer<typeof TerminalDataEventSchema>;
export type TerminalResizeRequest = z.infer<typeof TerminalResizeRequestSchema>;
export type TerminalCloseRequest = z.infer<typeof TerminalCloseRequestSchema>;
export type TerminalExitEvent = z.infer<typeof TerminalExitEventSchema>;
```

### New file: `packages/api-contracts/src/types/output.ts`

```typescript
import { z } from 'zod';

/**
 * Output channel schemas for logs/build output.
 */
export const OutputAppendEventSchema = z.object({
  /** Channel name (Build, Test, Extension Host, Agent Host) */
  channel: z.string(),
  
  /** Text to append to channel output */
  text: z.string(),
});

export const OutputClearRequestSchema = z.object({
  /** Channel name to clear */
  channel: z.string(),
});

export type OutputAppendEvent = z.infer<typeof OutputAppendEventSchema>;
export type OutputClearRequest = z.infer<typeof OutputClearRequestSchema>;
```

### New file: `packages/api-contracts/src/types/diagnostics.ts`

```typescript
import { z } from 'zod';

/**
 * Diagnostic severity levels (aligned with LSP DiagnosticSeverity).
 */
export const DiagnosticSeveritySchema = z.enum(['error', 'warning', 'info', 'hint']);

/**
 * Diagnostic (problem) for a file.
 * Security: Does NOT include file contents, only references (line/column).
 */
export const DiagnosticSchema = z.object({
  /** Severity level */
  severity: DiagnosticSeveritySchema,
  
  /** Diagnostic message */
  message: z.string(),
  
  /** Line number (1-indexed) */
  line: z.number().int().min(1),
  
  /** Column number (1-indexed) */
  column: z.number().int().min(1),
  
  /** Source of diagnostic (TypeScript, ESLint, etc.) */
  source: z.string(),
  
  /** Optional diagnostic code (e.g., TS2322, no-unused-vars) */
  code: z.string().optional(),
});

export const DiagnosticsUpdateEventSchema = z.object({
  /** File URI (absolute path) */
  uri: z.string(),
  
  /** Array of diagnostics for this file (empty array = clear diagnostics) */
  diagnostics: z.array(DiagnosticSchema),
});

export type DiagnosticSeverity = z.infer<typeof DiagnosticSeveritySchema>;
export type Diagnostic = z.infer<typeof DiagnosticSchema>;
export type DiagnosticsUpdateEvent = z.infer<typeof DiagnosticsUpdateEventSchema>;
```

### Update: `packages/api-contracts/src/ipc-channels.ts`

Add new channel constants:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...
  
  // Terminal PTY channels
  /** Create new terminal session */
  TERMINAL_CREATE: 'terminal:create',
  
  /** Write data to terminal (user input) */
  TERMINAL_WRITE: 'terminal:write',
  
  /** Resize terminal dimensions */
  TERMINAL_RESIZE: 'terminal:resize',
  
  /** Close terminal session */
  TERMINAL_CLOSE: 'terminal:close',
  
  // Terminal events (main -> renderer)
  /** Terminal output data event */
  TERMINAL_DATA: 'terminal:data',
  
  /** Terminal session exited event */
  TERMINAL_EXIT: 'terminal:exit',
  
  // Output channels
  /** Append text to output channel (main -> renderer event) */
  OUTPUT_APPEND: 'output:append',
  
  /** Clear output channel */
  OUTPUT_CLEAR: 'output:clear',
  
  // Diagnostics/Problems
  /** Update diagnostics for file (main -> renderer event) */
  DIAGNOSTICS_UPDATE: 'diagnostics:update',
  
  /** Clear all diagnostics */
  DIAGNOSTICS_CLEAR: 'diagnostics:clear',
} as const;
```

### Update: `packages/api-contracts/src/preload-api.ts`

Add terminal/output/diagnostics APIs:

```typescript
export interface PreloadAPI {
  // ... existing APIs ...
  
  /**
   * Terminal APIs (PTY operations).
   * Security: All PTY operations run in main process only.
   */
  terminal: {
    /**
     * Create new terminal session.
     * @param request - Shell, cwd, env options
     * @returns Promise resolving to session ID
     */
    create(request: TerminalCreateRequest): Promise<TerminalCreateResponse>;
    
    /**
     * Write data to terminal (user input).
     * @param request - Session ID and data
     */
    write(request: TerminalWriteRequest): Promise<void>;
    
    /**
     * Resize terminal dimensions.
     * @param request - Session ID, cols, rows
     */
    resize(request: TerminalResizeRequest): Promise<void>;
    
    /**
     * Close terminal session.
     * @param request - Session ID
     */
    close(request: TerminalCloseRequest): Promise<void>;
    
    /**
     * Subscribe to terminal output data events.
     * @param callback - Called when PTY produces output
     * @returns Unsubscribe function
     */
    onData(callback: (event: TerminalDataEvent) => void): () => void;
    
    /**
     * Subscribe to terminal exit events.
     * @param callback - Called when PTY process exits
     * @returns Unsubscribe function
     */
    onExit(callback: (event: TerminalExitEvent) => void): () => void;
  };
  
  /**
   * Output channel APIs (logs/build output).
   */
  output: {
    /**
     * Clear output channel.
     * @param request - Channel name
     */
    clear(request: OutputClearRequest): Promise<void>;
    
    /**
     * Subscribe to output append events.
     * @param callback - Called when text is appended to channel
     * @returns Unsubscribe function
     */
    onAppend(callback: (event: OutputAppendEvent) => void): () => void;
  };
  
  /**
   * Diagnostics/Problems APIs.
   */
  diagnostics: {
    /**
     * Clear all diagnostics.
     */
    clear(): Promise<void>;
    
    /**
     * Subscribe to diagnostics update events.
     * @param callback - Called when diagnostics for a file change
     * @returns Unsubscribe function
     */
    onUpdate(callback: (event: DiagnosticsUpdateEvent) => void): () => void;
  };
}
```

### Update: `packages/api-contracts/src/index.ts`

Export new types:

```typescript
export * from './types/terminal';
export * from './types/output';
export * from './types/diagnostics';
```

## IPC + process boundaries

### Main process IPC handlers

**New file: `apps/electron-shell/src/main/services/TerminalService.ts`**

Responsibilities:
- Spawn PTY sessions using `node-pty` library
- Manage active sessions in Map<sessionId, IPty>
- Validate session IDs on every request (prevent hijacking)
- Restrict cwd to workspace directory (call workspaceService.getWorkspace())
- Sanitize environment variables (filter out dangerous vars like LD_PRELOAD)
- Limit concurrent sessions (max 10, reject new sessions if at limit)
- Forward PTY data to renderer via `webContents.send(TERMINAL_DATA, ...)`
- Handle PTY exit events and cleanup
- **NEVER log terminal I/O** (may contain secrets like passwords, API keys)

**Security validations:**
1. `cwd` must be within workspace (or use workspace root if not specified)
2. `shell` must be absolute path or basename (validate against known shells: bash, sh, zsh, pwsh, cmd)
3. `env` must not include dangerous vars (LD_PRELOAD, NODE_OPTIONS, etc.)
4. Session ID must be valid UUID and exist in active sessions map
5. Resize dimensions must be within bounds (cols: 10-500, rows: 5-200)

**Update: `apps/electron-shell/src/main/ipc-handlers.ts`**

Register new IPC handlers:

```typescript
// Terminal PTY handlers
ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_event, request: unknown) => {
  const validated = TerminalCreateRequestSchema.parse(request);
  return await terminalService.createSession(validated);
});

ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_event, request: unknown) => {
  const validated = TerminalWriteRequestSchema.parse(request);
  await terminalService.write(validated.sessionId, validated.data);
});

ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_event, request: unknown) => {
  const validated = TerminalResizeRequestSchema.parse(request);
  await terminalService.resize(validated.sessionId, validated.cols, validated.rows);
});

ipcMain.handle(IPC_CHANNELS.TERMINAL_CLOSE, async (_event, request: unknown) => {
  const validated = TerminalCloseRequestSchema.parse(request);
  await terminalService.close(validated.sessionId);
});

// Output clear handler
ipcMain.handle(IPC_CHANNELS.OUTPUT_CLEAR, async (_event, request: unknown) => {
  const validated = OutputClearRequestSchema.parse(request);
  // No-op for now (output is renderer-side only for this spec)
  // Future: if output persisted in main, clear it here
});

// Diagnostics clear handler
ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_CLEAR, async () => {
  // No-op for now (diagnostics are renderer-side only for this spec)
  // Future: if diagnostics aggregated in main, clear them here
});
```

**New file: `apps/electron-shell/src/main/services/OutputService.ts`** (optional, for future use)

Placeholder service for output channel management. For this spec, output is renderer-side only (no main process state). This service can be added later when extensions contribute output channels.

**New file: `apps/electron-shell/src/main/services/DiagnosticsService.ts`** (optional, for future use)

Placeholder service for diagnostics aggregation. For this spec, diagnostics are renderer-side only (mock data). This service can be added later when TypeScript/ESLint integration is implemented.

### Preload script

**Update: `apps/electron-shell/src/preload/index.ts`**

Expose terminal/output/diagnostics APIs via contextBridge:

```typescript
// Terminal APIs
terminal: {
  create: (request: TerminalCreateRequest) => 
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, request),
  
  write: (request: TerminalWriteRequest) => 
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, request),
  
  resize: (request: TerminalResizeRequest) => 
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, request),
  
  close: (request: TerminalCloseRequest) => 
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CLOSE, request),
  
  onData: (callback: (event: TerminalDataEvent) => void) => {
    const listener = (_: IpcRendererEvent, event: TerminalDataEvent) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, listener);
  },
  
  onExit: (callback: (event: TerminalExitEvent) => void) => {
    const listener = (_: IpcRendererEvent, event: TerminalExitEvent) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, listener);
  },
},

// Output APIs
output: {
  clear: (request: OutputClearRequest) => 
    ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_CLEAR, request),
  
  onAppend: (callback: (event: OutputAppendEvent) => void) => {
    const listener = (_: IpcRendererEvent, event: OutputAppendEvent) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.OUTPUT_APPEND, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OUTPUT_APPEND, listener);
  },
},

// Diagnostics APIs
diagnostics: {
  clear: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_CLEAR),
  
  onUpdate: (callback: (event: DiagnosticsUpdateEvent) => void) => {
    const listener = (_: IpcRendererEvent, event: DiagnosticsUpdateEvent) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.DIAGNOSTICS_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DIAGNOSTICS_UPDATE, listener);
  },
},
```

## UI components and routes

### Bottom Panel Tab Structure

**Update: `apps/electron-shell/src/renderer/components/layout/BottomPanel.tsx`**

Replace placeholder with tab bar and view switching:

```typescript
interface BottomPanelTab {
  id: 'terminal' | 'output' | 'problems';
  label: string;
  icon: ReactNode;
  component: ComponentType;
}

const TABS: BottomPanelTab[] = [
  { id: 'terminal', label: 'Terminal', icon: <TerminalIcon />, component: TerminalView },
  { id: 'output', label: 'Output', icon: <OutputIcon />, component: OutputView },
  { id: 'problems', label: 'Problems', icon: <ProblemsIcon />, component: ProblemsView },
];

// State: activeTab persisted to localStorage
// Render: <TabBar> + active view component
```

### Terminal Components

**New directory: `apps/electron-shell/src/renderer/components/terminal/`**

- `TerminalView.tsx` — Container for terminal sessions with sub-tabs
- `Terminal.tsx` — xterm.js wrapper component (lazy-loaded)
- `TerminalLoader.tsx` — Loading spinner while xterm.js loads
- `TerminalSessionTabs.tsx` — Sub-tab bar for terminal sessions
- `useTerminal.tsx` — Custom hook for xterm.js lifecycle

**Lazy loading strategy (follows Monaco pattern from 040):**

```typescript
// TerminalView.tsx
const [xtermModule, setXtermModule] = useState<typeof XtermModule | null>(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (activeTab === 'terminal' && !xtermModule && !loading) {
    setLoading(true);
    import('xterm').then(module => {
      setXtermModule(module);
      setLoading(false);
    });
  }
}, [activeTab]);

// Render: loading ? <TerminalLoader /> : <Terminal xtermModule={xtermModule} />
```

**Context: `apps/electron-shell/src/renderer/contexts/TerminalContext.tsx`**

State management:
- Track active terminal sessions: `{ sessionId, name, isActive }[]`
- Handle new session creation (call `window.api.terminal.create()`)
- Handle session close (call `window.api.terminal.close()`)
- Persist session metadata to localStorage (session IDs, names)
- Subscribe to terminal data/exit events via `window.api.terminal.onData/onExit`

**Persistence strategy:**
- Store in localStorage: `{ sessionIds: string[], sessionNames: Record<string, string>, activeSessionId: string }`
- On app relaunch: iterate sessionIds, call `window.api.terminal.create()` for each (creates new PTY, old sessions are lost)
- **NOT IMPLEMENTED:** Full session restoration (command history, scrollback) — future enhancement

### Output Components

**New directory: `apps/electron-shell/src/renderer/components/output/`**

- `OutputView.tsx` — Container for output viewer with channel dropdown
- `OutputViewer.tsx` — Virtualized text viewer (uses `@tanstack/react-virtual`)
- `OutputChannelSelector.tsx` — Dropdown for channel selection

**State management:**
- Store output per channel: `Map<string, string[]>` (array of lines)
- Subscribe to `window.api.output.onAppend()` events
- Auto-scroll to bottom (detect manual scroll to disable auto-scroll)

### Problems Components

**New directory: `apps/electron-shell/src/renderer/components/problems/`**

- `ProblemsView.tsx` — Container for problems panel with summary header
- `ProblemsTable.tsx` — Virtualized table (uses `@tanstack/react-virtual`)
- `DiagnosticRow.tsx` — Table row component with severity icon

**State management:**
- Aggregate diagnostics from all sources: `Map<string, Diagnostic[]>` (keyed by file URI)
- Subscribe to `window.api.diagnostics.onUpdate()` events
- Sort diagnostics by severity (errors first, then warnings, infos, hints)
- Display counts in summary header

### UI-Kit Components (packages/ui-kit)

**New components:**
- `TabBar.tsx` — Reusable tab navigation (horizontal tabs with active state)
- `VirtualizedList.tsx` — Wrapper around `@tanstack/react-virtual` for Output/Problems

**Styling (Tailwind 4 tokens):**
- Use existing Tailwind 4 theme from `packages/ui-kit/tailwind.config.ts`
- Terminal: `bg-gray-950`, `text-gray-100`, cursor `bg-blue-500`
- Tab bar: `bg-gray-800`, active tab `bg-gray-900` with `border-t-2 border-blue-500`
- Problems table: alternating rows `bg-gray-800`/`bg-gray-850`

## Data model changes

### Terminal State

**Renderer (localStorage):**
- Key: `terminal-sessions-${workspacePath}` (per workspace, or 'global' if no workspace)
- Value: `{ sessionIds: string[], sessionNames: Record<string, string>, activeSessionId: string }`

**Main (memory only):**
- `Map<sessionId, IPty>` — Active PTY sessions
- No persistence in main (sessions are ephemeral)

### Output State

**Renderer (memory only):**
- `Map<channel, string[]>` — Output lines per channel
- No persistence (output cleared on app restart)

### Diagnostics State

**Renderer (memory only):**
- `Map<fileUri, Diagnostic[]>` — Diagnostics per file
- No persistence (diagnostics re-generated on app restart)

### Bottom Panel State

**Renderer (localStorage):**
- Key: `bottom-panel-active-tab-${workspacePath}`
- Value: `'terminal' | 'output' | 'problems'`

## Failure modes + recovery

### Terminal PTY failures

**Failure:** PTY spawn fails (invalid shell, cwd not found, permission denied)
- **Detection:** `node-pty` throws error on spawn
- **Recovery:** Return error to renderer, display error message in terminal view
- **User action:** Check workspace exists, verify shell path in settings

**Failure:** PTY process exits unexpectedly (e.g., shell crashes)
- **Detection:** PTY 'exit' event with non-zero exit code
- **Recovery:** Send TERMINAL_EXIT event to renderer, display exit code in terminal
- **User action:** Create new terminal session

**Failure:** Session ID not found (hijacking attempt or stale session)
- **Detection:** Validate session ID in TerminalService before every operation
- **Recovery:** Return error to renderer, display "Session not found" message
- **User action:** Create new terminal session

**Failure:** Terminal resize dimensions invalid (malicious input)
- **Detection:** Zod validation fails (cols/rows out of bounds)
- **Recovery:** Reject request with validation error
- **User action:** Should not occur in normal use (UI enforces valid dimensions)

### xterm.js lazy loading failures

**Failure:** Dynamic import fails (network error, chunk not found)
- **Detection:** Promise rejection in `import('xterm')`
- **Recovery:** Display error message with retry button
- **User action:** Click retry button to re-attempt import

**Failure:** xterm.js fails to initialize (canvas rendering error)
- **Detection:** Exception in xterm constructor or `terminal.open()`
- **Recovery:** Display error message, fallback to "Terminal unavailable"
- **User action:** Restart app or check GPU/canvas support

### IPC communication failures

**Failure:** Renderer cannot reach main (IPC timeout)
- **Detection:** `window.api.terminal.create()` promise never resolves
- **Recovery:** Implement timeout in renderer (e.g., 5 seconds), display error message
- **User action:** Restart app

**Failure:** Main process crashes during terminal operation
- **Detection:** Electron main process exit event
- **Recovery:** Not recoverable; Electron will restart app
- **User action:** Re-open terminal sessions

## Testing strategy

### Unit tests

**api-contracts:**
- `terminal.test.ts` — Validate Zod schemas for all terminal contracts
- `output.test.ts` — Validate Zod schemas for output contracts
- `diagnostics.test.ts` — Validate Zod schemas for diagnostics contracts

**Main process:**
- `TerminalService.test.ts`:
  - Test PTY session creation (mock `node-pty`)
  - Test session validation (invalid session ID, cwd outside workspace)
  - Test environment sanitization (remove dangerous vars)
  - Test concurrent session limit (reject 11th session)
  - Test terminal write/resize/close operations
  - **NO LOGGING VERIFICATION:** Confirm terminal I/O is NEVER logged (manual code review)

- `ipc-handlers.test.ts`:
  - Test IPC handlers for terminal/output/diagnostics
  - Test Zod validation for all requests
  - Test error handling (invalid payloads, service failures)

**Renderer:**
- `TerminalView.test.tsx`:
  - Test lazy loading (mock dynamic import)
  - Test session creation/close/rename
  - Test tab switching

- `Terminal.test.tsx`:
  - Test xterm.js rendering (mock xterm module)
  - Test user input handling (send to IPC)
  - Test PTY output handling (receive from IPC, write to xterm)

- `OutputView.test.tsx`:
  - Test output viewer rendering
  - Test channel switching
  - Test auto-scroll behavior

- `ProblemsView.test.tsx`:
  - Test diagnostics table rendering
  - Test severity sorting
  - Test summary counts

- `TerminalContext.test.tsx`:
  - Test session state management
  - Test persistence to localStorage
  - Test session restoration on app relaunch

**UI-Kit:**
- `TabBar.test.tsx`:
  - Test tab rendering and click handling
  - Test active tab highlighting

- `VirtualizedList.test.tsx`:
  - Test virtualization with large datasets (10K+ items)
  - Test scrolling behavior

### Integration tests

**E2E (Playwright):**

`test/e2e/terminal.spec.ts`:
- Test 1: Create terminal session
  - Click Terminal tab → click + button → verify xterm canvas renders
- Test 2: Type in terminal and see output
  - Type `echo hello` → press Enter → verify "hello" appears in output
- Test 3: Create multiple sessions
  - Create 3 terminal sessions → verify 3 sub-tabs appear → switch between sessions
- Test 4: Close terminal session
  - Create session → click close button → verify session removed
- Test 5: Terminal session persistence
  - Create session → close app → reopen app → verify session restored (new PTY, same metadata)

`test/e2e/output.spec.ts`:
- Test 1: Switch to Output tab
  - Click Output tab → verify output viewer renders with channel dropdown
- Test 2: Output auto-scroll
  - Append 100 lines to output → verify auto-scrolled to bottom

`test/e2e/problems.spec.ts`:
- Test 1: Switch to Problems tab
  - Click Problems tab → verify diagnostics table renders
- Test 2: Diagnostics display
  - Simulate DIAGNOSTICS_UPDATE event with mock data → verify table shows diagnostics

### Verification commands

After each task:
1. `pnpm -r typecheck` — TypeScript compiles with 0 errors
2. `pnpm -r lint` — ESLint passes with 0 errors
3. `pnpm -r test` — Unit tests pass
4. `pnpm -r build` — Build succeeds, verify xterm.js in separate chunk

Build verification (lazy loading):
```bash
pnpm -r build
# Check dist/renderer output for xterm chunk:
# Should see: terminal-<hash>.js (not in main-<hash>.js)
ls apps/electron-shell/dist/renderer/*.js | grep terminal
```

Manual verification:
1. Run app in dev mode: `pnpm dev`
2. Open Terminal tab → verify xterm.js loads (spinner → terminal canvas)
3. Type `ls` in terminal → verify output appears
4. Create 3 terminal sessions → verify sub-tabs and switching
5. Close app → reopen → verify sessions restored
6. Switch to Output/Problems tabs → verify views render

## Rollout / migration

### Phase 1: Contracts (MUST complete first)
1. Define all Zod schemas in `packages/api-contracts`
2. Update IPC_CHANNELS constants
3. Update PreloadAPI interface
4. Run `pnpm -r typecheck` — confirm contracts compile

### Phase 2: Main process (PTY backend)
1. Add `node-pty` dependency
2. Implement TerminalService
3. Register IPC handlers
4. Write unit tests for TerminalService
5. Run `pnpm -r test` — confirm service tests pass

### Phase 3: Preload (IPC bridge)
1. Expose terminal/output/diagnostics APIs in preload
2. Test IPC communication (unit tests)

### Phase 4: Renderer (UI)
1. Add xterm.js dependencies
2. Implement lazy loading for xterm.js
3. Build TerminalView/Terminal components
4. Build OutputView/ProblemsView components
5. Update BottomPanel with tab bar
6. Implement TerminalContext for state management
7. Write unit tests for all components

### Phase 5: UI-Kit components
1. Build TabBar component
2. Build VirtualizedList component
3. Write unit tests

### Phase 6: Integration + E2E
1. Write Playwright E2E tests
2. Run E2E tests in CI
3. Verify xterm.js lazy loading (build analysis)

### Phase 7: Polish + docs
1. Add keyboard shortcuts (Ctrl+`, Ctrl+Shift+U for Output, Ctrl+Shift+M for Problems)
2. Update README with terminal usage instructions
3. Code review for security (verify no terminal logging, cwd validation, etc.)

### No migration needed
- No existing data to migrate (terminal sessions are new feature)
- No breaking changes to existing APIs
- Bottom panel placeholder is replaced (no user-facing changes)

## Risks + mitigations

### Risk 1: node-pty native dependency fails to compile on Windows

**Likelihood:** Medium (node-pty requires node-gyp and Python on Windows)

**Impact:** High (terminal feature unusable)

**Mitigation:**
- Use `node-pty-prebuilt` if available (precompiled binaries)
- Document build requirements (Python, Visual Studio Build Tools) in CONTRIBUTING.md
- Test on Windows CI before merging
- Fallback: Display error message with link to build instructions

### Risk 2: xterm.js bundle size exceeds performance budget

**Likelihood:** Low (xterm.js is ~300KB minified, under budget)

**Impact:** Medium (initial load time impact if not lazy-loaded)

**Mitigation:**
- Verify lazy loading via build analysis BEFORE merging
- Use xterm-addon-webgl for performance (optional, reduces CPU usage)
- Do NOT include xterm.js in initial renderer bundle (enforce in CI)

### Risk 3: Terminal I/O logging exposes secrets

**Likelihood:** Low (explicit NO LOGGING in code)

**Impact:** Critical (P3 violation, secrets leaked)

**Mitigation:**
- Code review BEFORE merging (verify no console.log, logger.info, etc. in TerminalService)
- Add comment in TerminalService: "// SECURITY: DO NOT LOG TERMINAL I/O (may contain secrets)"
- Automated check: grep for `console.log.*terminal` in CI (fail if found)

### Risk 4: Terminal cwd escapes workspace (path traversal)

**Likelihood:** Low (validation in TerminalService)

**Impact:** High (security breach, arbitrary file access)

**Mitigation:**
- Validate cwd with `path.resolve()` and `startsWith(workspaceRoot)` in TerminalService
- Reject absolute paths outside workspace
- Reject relative paths with `..` that escape workspace
- Unit test for path traversal attempts (e.g., `cwd: '../../../etc'`)

### Risk 5: Session hijacking via guessable session IDs

**Likelihood:** Low (using UUIDs)

**Impact:** Medium (attacker can write to another user's terminal)

**Mitigation:**
- Use UUID v4 for session IDs (cryptographically random)
- Validate session ID exists in TerminalService.sessions Map on EVERY operation
- Do NOT expose session IDs in logs or error messages

### Risk 6: PTY process limit exhaustion (DoS)

**Likelihood:** Low (max 10 sessions enforced)

**Impact:** Low (user cannot create more terminals, but app remains stable)

**Mitigation:**
- Enforce max 10 concurrent sessions in TerminalService
- Display error message: "Maximum terminal sessions reached (10). Close a session to create a new one."
- Future: make limit configurable via settings

### Risk 7: xterm.js dynamic import fails in production build

**Likelihood:** Medium (Vite code splitting issues)

**Impact:** High (terminal feature unusable)

**Mitigation:**
- Test production build BEFORE merging (pnpm build → test app)
- Verify xterm chunk loads in browser DevTools (Network tab)
- Add retry mechanism in TerminalLoader (3 attempts with exponential backoff)
- Display error message with "Retry" button

## Done definition

### Acceptance criteria (from spec.md)

All 24 criteria must be met:

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

### Code review checklist

- [ ] All IPC contracts defined in api-contracts with Zod schemas
- [ ] No terminal I/O logging in TerminalService (manual grep verification)
- [ ] Terminal cwd validation (no path traversal)
- [ ] Session ID validation on every IPC request
- [ ] xterm.js excluded from initial bundle (build output inspection)
- [ ] Environment variable sanitization (no LD_PRELOAD, NODE_OPTIONS, etc.)
- [ ] Max concurrent sessions enforced (10)
- [ ] Proper IPC event cleanup (removeListener on unmount)
- [ ] Tailwind 4 tokens used consistently (no hardcoded colors)
- [ ] localStorage keys scoped per workspace

### Performance verification

- [ ] Initial renderer bundle size (without xterm.js): <2MB
- [ ] xterm.js lazy chunk size: <300KB gzipped
- [ ] Terminal renders within 1 second after dynamic import
- [ ] Output viewer handles 10,000+ lines without jank
- [ ] Problems panel handles 1,000+ diagnostics without jank
- [ ] Tab switching latency: <16ms (measured in DevTools Performance)

### Documentation

- [ ] Update README with terminal usage instructions
- [ ] Document keyboard shortcuts (Ctrl+`, etc.)
- [ ] Document build requirements for node-pty (Windows)
- [ ] Add JSDoc comments to all new services/components
- [ ] Update architecture diagram (if exists) to show TerminalService

### Ship criteria

- All acceptance criteria met
- All tests passing (unit + E2E)
- Code review approved
- Performance budgets met
- Security review passed (no logging, path validation, etc.)
- Manual QA passed on Windows/macOS/Linux
