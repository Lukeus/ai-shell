# feature.spec.md — Global Error Management + Crash Recovery (ai-shell)

## Goals
- Prevent avoidable runtime crashes from taking down the app (especially IPC + renderer failures).
- Make failures observable: consistent logs + structured error reports (sanitized, no secrets).
- Provide automatic recovery:
  - Renderer crash → reload/recreate window + restore session.
  - Main fatal error → relaunch with crash-loop protection and Safe Mode.
- Standardize error handling across **renderer → preload → main → host processes** (agent-host/extension-host).

## Non-goals
- Eliminating all crashes (native module segfaults, GPU driver crashes, OOM, OS kill).
- Implementing a third-party telemetry backend (Sentry/Bugsnag) in this feature (leave as optional integration).
- Building a full “crash UI” with bug report forms (keep UX minimal and practical).
- Refactoring unrelated IPC/business logic beyond adopting the Result envelope.

## Personas
- **Developer (ai-shell contributor)**: wants actionable diagnostics, reproducible failure paths, and fewer “works on my machine” bugs.
- **Power user (IDE user)**: wants the app to recover automatically and not lose workspace context.
- **Security/Platform owner**: requires that no secrets or sensitive content leak through diagnostics.

## User stories
1. As a user, when the renderer crashes, the app automatically recovers (reloads or recreates the window) and restores the last workspace.
2. As a user, when the UI encounters a fatal React error, I see a recovery screen with “Reload” and “Safe Mode”.
3. As a developer, unhandled errors are captured in a consistent format and saved to logs.
4. As a developer, IPC failures never surface as unhandled exceptions in the renderer; they return structured `Result` errors.
5. As a security owner, error reports never contain secrets (env vars, tokens, safeStorage payloads).

## Acceptance criteria
### Contracts-first + IPC safety
- All new diagnostics and Result types are defined in `packages/api-contracts` with Zod validation (P6).
- `ipcMain.handle` implementations for covered channels must not throw across IPC; they return `Result<T>`.
- Preload must not expose raw `ipcRenderer.invoke` directly for covered APIs; it must use an `invokeSafe()` wrapper that returns `Result<T>` even if invoke fails.

### Main process global handling
- Main process installs global handlers early (before windows):
  - `process.on('uncaughtException')`
  - `process.on('unhandledRejection')`
  - `app.on('render-process-gone')`
  - `app.on('child-process-gone')`
- On **main fatal**, app performs `relaunch()` + `exit(1)` (no “limp mode”).
- Crash-loop protection:
  - Detect ≥3 relaunches within 60 seconds → start in **Safe Mode** (disables host processes) and show a minimal warning dialog/banner.

### Renderer UX + recovery
- Renderer registers global listeners for:
  - `window.error`
  - `window.unhandledrejection`
  - Reports sanitized diagnostics to main.
- React root is wrapped with an `ErrorBoundary` that shows:
  - “Reload window”
  - “Restart in Safe Mode”
  - “Open logs” (or reveal log path)
- Renderer crash recovery:
  - On renderer crash event, main reloads or recreates the BrowserWindow.
  - Workspace path (if open) is restored (no secrets).

### Observability + storage
- Errors are persisted to a local log file under `app.getPath('userData')/logs/…` (or existing logging strategy).
- A `diag:get-log-path` API returns the log location.
- Error reports are sanitized:
  - No raw environment dumps.
  - No file contents.
  - Stack traces are length-limited.

## UX flow
1. **JS error in renderer**
   - Captured by global listeners → sent to main diagnostics.
   - UI may show non-blocking toast, continues running.
2. **React render crash**
   - ErrorBoundary catches → recovery screen.
   - User chooses Reload / Safe Mode.
3. **Renderer process crash**
   - Main receives `render-process-gone` → reload window.
   - If repeated, recreate window and restore workspace.
4. **Main fatal**
   - Main logs + marks crash timestamp → relaunch.
   - If crash loop threshold exceeded → Safe Mode on next boot.

## Edge cases
- `unhandledrejection` reason is not an `Error` (string/object/null).
- Error objects that are not serializable through IPC.
- Extremely large stacks / recursive causes (must truncate).
- Renderer crash while workspace is mid-write (ensure writes are atomic or guarded).
- Crash loop caused by corrupted persisted state (must reset to defaults safely).
- Host process crash storms (agent-host repeatedly dying) → backoff + safe mode.

## Telemetry (local, no external service required)
- `errors.count` by source/kind
- `renderer_crash.count` + last `reason`
- `main_fatal.count` + crash loop counter
- `safe_mode.enabled` boolean
- Optional: `ipc.error_rate` by channel

## Risks
- Over-capturing sensitive data (mitigated by strict schema + sanitization + truncation).
- Infinite relaunch loops (mitigated by crash loop detection + safe mode).
- Masking errors by over-swallowing (mitigated by logging + `Result` error surfacing in UI).
- Breaking existing IPC expectations (mitigated by incremental adoption + compat wrappers).
