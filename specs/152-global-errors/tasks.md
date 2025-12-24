# feature.tasks.md — Ordered implementation tasks (1–4h each)

## Task 1 — Add Result + Diagnostics contracts (contracts-first)
**Files**
- `packages/api-contracts/src/types/result.ts` (new)
- `packages/api-contracts/src/types/diagnostics.ts` (new)
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts` (export new types)
- Tests: `packages/api-contracts/src/**/*.test.ts` (as applicable)

**Work**
- Define `Result<T>` + `ErrorInfo` schemas (Zod) with strict, non-secret fields.
- Define `ErrorReport` schema (Zod) with sanitizable fields.
- Add `diag:*` IPC channels + preload API surface.

**Verify**
- `pnpm --filter packages-api-contracts build`
- `pnpm --filter packages-api-contracts test` (if tests exist)

**Invariants**
- Contracts-first (P6)
- No secrets in schemas (P3)

**Done =**
- Types compile, exported, and validated by tests/build.

---

## Task 2 — Main: safe IPC wrapper + DiagnosticsService
**Files**
- `apps/electron-shell/src/main/ipc/safeIpc.ts` (new)
- `apps/electron-shell/src/main/services/DiagnosticsService.ts` (new)
- `apps/electron-shell/src/main/ipc-handlers.ts` (or split module)

**Work**
- Implement `handleSafe()` wrapper around `ipcMain.handle`:
  - validates input/output (if provided)
  - catches exceptions and returns `Result<T>`
- Implement DiagnosticsService:
  - append structured logs
  - truncation limits (stack/message/meta)
  - sanitize known risky fields (no env dumps)
  - create log dir under `userData`

**Verify**
- `pnpm --filter apps-electron-shell build` (or your workspace build)
- Unit tests for wrapper + sanitization

**Invariants**
- No thrown errors crossing IPC boundary for covered channels

**Done =**
- Diagnostics IPC handlers can be registered safely and never throw.

---

## Task 3 — Main: diagnostics IPC endpoints
**Files**
- `apps/electron-shell/src/main/ipc/diagnostics.ts` (new) or `ipc-handlers.ts`
- `apps/electron-shell/src/main/services/DiagnosticsService.ts` (from Task 2)

**Work**
- Implement:
  - `diag:report-error` (fire-and-forget or `Result<void>`)
  - `diag:get-log-path` → `Result<{ path: string }>`
  - `diag:on-fatal` event emitter (main → renderer)
- Enforce schema validation (Zod) on incoming error reports.

**Verify**
- Launch app; call `window.api.diagnostics.getLogPath()` from renderer; confirm path.
- Confirm errors are written to log.

**Invariants**
- P1/P2: no new privileged APIs leaked to renderer

**Done =**
- Renderer can report errors to main and retrieve log path via contract APIs.

---

## Task 4 — Preload: invokeSafe + diagnostics bridge
**Files**
- `apps/electron-shell/src/preload/invokeSafe.ts` (new)
- `apps/electron-shell/src/preload/index.ts`

**Work**
- Implement `invokeSafe<T>()` returning `Result<T>` even if invoke fails.
- Expose `window.api.diagnostics.*` using invokeSafe.
- Add preload-side global rejection handler that reports preload errors to main (best effort).

**Verify**
- `pnpm dev` and confirm `window.api.diagnostics` exists.
- Force an IPC failure (invalid channel in dev) and confirm renderer receives `{ ok:false }`.

**Invariants**
- Renderer remains sandboxed; preload surface stays minimal

**Done =**
- No preload-exposed method throws into renderer for diagnostics endpoints.

---

## Task 5 — Renderer: global error listeners + ErrorBoundary recovery UX
**Files**
- `apps/electron-shell/src/renderer/diagnostics/installGlobalErrorHandlers.ts` (new)
- `apps/electron-shell/src/renderer/components/ErrorBoundary.tsx` (new)
- `apps/electron-shell/src/renderer/components/CrashScreen.tsx` (new)
- `apps/electron-shell/src/renderer/main.tsx` (wire up)
- `apps/electron-shell/src/renderer/App.tsx` (wrap root)

**Work**
- Install `window.error` + `window.unhandledrejection` → `reportError()`.
- Add React ErrorBoundary showing CrashScreen:
  - Reload window (calls `location.reload()` or triggers main action)
  - Restart in Safe Mode (IPC call to set safe mode + relaunch)
  - Open logs (show path from `getLogPath`)
- Subscribe to `diag:on-fatal` to show a banner or prompt.

**Verify**
- Intentionally throw in a component render to see CrashScreen.
- Confirm error gets logged and app is recoverable.

**Invariants**
- No secrets displayed in UI
- Recovery actions do not weaken security defaults

**Done =**
- React fatal errors become recoverable UX, not a blank window.

---

## Task 6 — Main: global guards + crash loop + renderer recovery policy
**Files**
- `apps/electron-shell/src/main/global-errors.ts` (new)
- `apps/electron-shell/src/main/index.ts` (install early)
- `apps/electron-shell/src/main/services/RuntimeStateService.ts` (new) or fold into DiagnosticsService

**Work**
- Install process/app-level handlers early.
- Implement crash-loop detection using `runtime-state.json`.
- Implement Safe Mode flag:
  - persisted
  - honored during boot (disable host processes)
- Add renderer crash recovery:
  - reload on first crash
  - recreate window on repeated crash window

**Verify**
- Dev/test trigger renderer crash; app recovers.
- Simulate crash loop by forcing main fatal twice/three times (test harness) and confirm Safe Mode.

**Invariants**
- Main fatal → relaunch (no zombie mode)
- Safe Mode doesn’t change Electron security flags

**Done =**
- App self-recovers from renderer crashes and protects against relaunch loops.

---

## Task 7 — Tests: unit + e2e crash simulation (test-only hook)
**Files**
- `apps/electron-shell/src/main/ipc/testOnly.ts` (new, gated by `NODE_ENV==='test'`)
- `test/e2e/app.spec.ts` (or new file)
- Unit tests under `apps/electron-shell/src/main/**/__tests__`

**Work**
- Add test-only IPC to trigger `webContents.forcefullyCrashRenderer()` (only in tests).
- E2E:
  - launch app
  - trigger crash
  - assert window recovers
  - assert log file contains an entry

**Verify**
- `pnpm test` (playwright)
- `pnpm --filter apps-electron-shell test` (if unit test runner exists)

**Invariants**
- Test-only channel not present in production builds

**Done =**
- Automated proof that crashes don’t equal dead app.

---

## Task 8 — Docs: update architecture + operational notes
**Files**
- `docs/architecture.md` (or your existing `docs/architecture.md` / `docs/architecture/errors.md`)

**Work**
- Document:
  - Result envelope rule for IPC
  - diagnostics channels
  - safe mode behavior
  - crash recovery policy and limits

**Verify**
- Docs build (if applicable) / markdown lint (if applicable)

**Done =**
- Future contributors can follow the rules without rediscovering them the hard way.
