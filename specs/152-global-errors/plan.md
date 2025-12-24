# feature.plan.md — Global Error Management + Crash Recovery (ai-shell)

## Architecture decisions
1. **Result envelope for IPC**
   - Standard `Result<T>` with `{ ok: true, value } | { ok: false, error }`.
   - Applies to diagnostics + gradually to critical IPC services (Search/Git/FsBroker/Workspace first).
2. **Diagnostics service in main**
   - Centralized log sink + IPC endpoints:
     - `diag:report-error` (renderer/preload → main)
     - `diag:get-log-path` (renderer → main)
     - `diag:on-fatal` (main → renderer push)
3. **Preload as a fault firewall**
   - Provide `invokeSafe(channel, args)` returning `Result<T>`.
   - No raw `ipcRenderer.invoke` leaking into renderer.
4. **Renderer resiliency**
   - Global `window` error listeners + React ErrorBoundary.
   - Minimal recovery UI (reload / safe mode / open logs).
5. **Crash recovery policy**
   - Renderer crash: reload first; if repeated within a short window, recreate BrowserWindow.
   - Main fatal: relaunch always; crash-loop detection enables Safe Mode.
6. **Safe Mode**
   - Stored in `userData` as non-secret JSON state.
   - Disables host process spawning (agent-host/extension-host) and optionally disables heavy features.

## Interfaces / contracts
### New contracts (packages/api-contracts)
- `types/result.ts`
  - `ErrorInfoSchema`
  - `ResultSchema<T>()`
  - `Result<T>` type
- `types/diagnostics.ts`
  - `ErrorReportSchema` (sanitized structured report)
- `ipc-channels.ts`
  - `DIAG_REPORT_ERROR`
  - `DIAG_GET_LOG_PATH`
  - `DIAG_ON_FATAL`
- `preload-api.ts`
  - `window.api.diagnostics.reportError(report): Promise<void | Result<void>>` (see compatibility note below)
  - `window.api.diagnostics.getLogPath(): Promise<Result<{ path: string }>>`
  - `window.api.diagnostics.onFatal(handler): void`

### Compatibility note
- Prefer `Result<T>` everywhere, but you can keep `reportError()` as `Promise<void>` if it’s strictly fire-and-forget (internally safe).
- For everything else, return `Result<T>`.

## Main process implementation
### Files / modules
- `apps/electron-shell/src/main/global-errors.ts`
  - Installs process/app event handlers.
  - Implements crash-loop tracking and safe mode decision.
- `apps/electron-shell/src/main/services/DiagnosticsService.ts`
  - Log append + rotation policy (basic).
  - Sanitization helpers (truncate stacks, strip known secret patterns, size limits).
- `apps/electron-shell/src/main/ipc/diagnostics.ts` (or `ipc-handlers.ts`)
  - Registers `diag:*` handlers, all safe.
- `apps/electron-shell/src/main/ipc/safeIpc.ts`
  - `handleSafe(channel, inputSchema?, outputSchema?, fn)` wrapper
  - Ensures no throws escape `ipcMain.handle`.

### Crash-loop + safe mode state
- State file: `${app.getPath('userData')}/runtime-state.json`
- Schema:
  - `safeMode: boolean`
  - `recentCrashes: string[]` (ISO timestamps)
  - `rendererCrashCount?: number` (optional)
- Rules:
  - On main fatal: push timestamp; if ≥3 within 60s → set `safeMode = true`.
  - On successful stable run (e.g., after 2 minutes) → clear `recentCrashes`.

### Window recovery
- Attach `render-process-gone` handling per window:
  - First crash: `win.reload()`
  - Repeated crash (e.g., 2 times in 30s): `win.destroy()` and create new window instance.
- Restore:
  - workspace path from `WorkspaceService.getState()`
  - layout state is already renderer localStorage (no change needed)
  - optional: editor tabs if you persist them later (out of scope unless already exists)

## Preload implementation
- `apps/electron-shell/src/preload/invokeSafe.ts`
  - `invokeSafe<T>(channel, args): Promise<Result<T>>` with try/catch.
- `apps/electron-shell/src/preload/index.ts`
  - Expose `window.api.diagnostics.*`
  - Ensure preload also reports its own unhandled rejections to main (best effort).

## Renderer implementation
- `apps/electron-shell/src/renderer/diagnostics/installGlobalErrorHandlers.ts`
  - Registers `window.error` and `window.unhandledrejection`.
  - Calls `window.api.diagnostics.reportError(...)`.
- `apps/electron-shell/src/renderer/components/CrashScreen.tsx`
  - Recovery UI: Reload / Safe Mode / Open Logs.
- `apps/electron-shell/src/renderer/components/ErrorBoundary.tsx`
  - Wrap App root and render `CrashScreen` on error.
- Subscribe to `window.api.diagnostics.onFatal(...)`:
  - Show banner and optionally trigger reload prompt.

## Data model changes
- New file in userData: `runtime-state.json` (non-secret, validated)
- Optional new file in userData: `logs/ai-shell.log` (or use existing logging system)

## Migrations
- None (create files on demand).
- If `runtime-state.json` is corrupt:
  - Reset to defaults (safe behavior: safeMode=false unless crash loop detected this run).

## Test strategy
### Unit tests
- `packages/api-contracts`: Zod schema tests for Result and ErrorReport (serialization/truncation).
- `apps/electron-shell` main:
  - `DiagnosticsService` sanitization + truncation behavior.
  - crash-loop detector (time-window logic).
  - `handleSafe` wrapper ensures no throw escapes.

### E2E tests (Playwright)
- Add a **test-only** IPC channel or menu command (guarded by `NODE_ENV === 'test'`) to:
  - call `webContents.forcefullyCrashRenderer()` to simulate renderer crash
- Verify:
  - app remains running
  - window recovers (reload/recreate)
  - diagnostics log file exists and contains a renderer crash entry
- Verify renderer security invariants still hold:
  - `typeof process === 'undefined'` in renderer

## Rollout plan
- Phase 1: Diagnostics + safe IPC wrapper for diagnostics only.
- Phase 2: Adopt Result envelope for highest-risk IPC services (FsBroker, Workspace, Git, Search).
- Phase 3: Add host process supervision + safe mode integration for agent-host/extension-host.

## Observability
- Local logs with timestamps + source/kind.
- Optional future: pluggable transport (Sentry) behind a flag, but off by default.

## Security checklist
- [ ] No secrets in ErrorReportSchema (P3).
- [ ] All error payloads sanitized + size-limited.
- [ ] No file contents in diagnostics.
- [ ] IPC channels contracts-first with Zod validation (P6).
- [ ] Renderer remains sandboxed; no extra Electron APIs exposed (P1/P2).
- [ ] Safe Mode does not weaken security defaults (no toggling nodeIntegration/webSecurity/etc.).
