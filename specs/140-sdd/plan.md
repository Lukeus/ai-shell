SDD Traceability + Parity (ai-shell)

## Architecture decisions

### 1) Source of truth: append-only trace ledger + materialized index
- **Ledger**: `.ai-shell/sdd/trace.jsonl` (append-only JSON lines)
  - Immutable history of provenance events (run lifecycle, file changes, overrides)
  - Safe by design: **metadata + hashes only**, no file contents
- **Index**: `.ai-shell/sdd/index.json` (materialized, rebuildable)
  - Fast queries for UI: file → runs/tasks, task → files, parity snapshots
- **Config**: `.ai-shell/sdd/config.json`
  - Track roots (globs) and debounce settings

Rationale: jsonl is resilient and auditable; index is fast and disposable.

### 2) Main-process ownership (P1) with contracts-first IPC (P6)
- All trace writing, hashing, watching, parity computation lives in **Main** as a singleton service.
- Renderer sees only a curated view via `window.api.sdd.*` (preload) and an optional sanitized event stream.

### 3) Settings-gated enablement
- SDD is controlled by `sdd.enabled` in Settings (default: false).
- When disabled, SddTraceService and watchers stop and skip new events.
- Commit enforcement uses `sdd.blockCommitOnUntrackedCodeChanges` and is disabled by default.
- Settings are stored via SettingsService (userData), not in workspace files.

### 4) Capture provenance at the moment of change (no "infer later")
Changes are attributed via:
- **Agent tool operations** (`workspace.write`/`workspace.update`): guaranteed linkage to active run
- **Main FS watcher** for manual edits: links to active run if present; otherwise records untracked drift

### 5) Optional enforcement at commit time (GitService integration)
- Commit blocking is configurable:
  - `sdd.blockCommitOnUntrackedCodeChanges: boolean` (default: false initially)
- If enabled, main checks parity before allowing `scm:commit`.
- Overrides require a reason and produce a trace event.

### 6) Eventing model
- Prefer request/response (`invoke/handle`) for queries and commands.
- Add a lightweight `ipcRenderer.on('sdd:changed')` style channel for UI live updates.
  - Payload is small and sanitized: parity + active run summary.

---

## Components and responsibilities

### Main process

#### New service: SddTraceService
**File**: `apps/electron-shell/src/main/services/SddTraceService.ts`

Responsibilities:
- Start/stop run
- Record events to ledger
- Maintain index
- Compute parity
- Provide query APIs to IPC handlers
- Optionally hook into GitService commit flow
- Respect `sdd.enabled` and stop watchers / writes when disabled

#### Watcher: SddWatcher (or embedded in SddTraceService)
**File**: `apps/electron-shell/src/main/services/SddWatcher.ts` (or embedded)

Responsibilities:
- Workspace-scoped file watching (debounced)
- Only track allowlisted roots (configurable)
- Emits `FILE_*` or `UNTRACKED_*` events into SddTraceService
- Groups “stormy” changes (branch switch / install) into batched events

#### GitService integration
**File**: `apps/electron-shell/src/main/services/GitService.ts`

Responsibilities:
- Before commit: call `SddTraceService.checkCommitAllowed()`
- If blocked: return a structured error payload (contracts-first), not a thrown string
- Enforcement gate uses `sdd.blockCommitOnUntrackedCodeChanges`

#### Agent tool integration
Wherever workspace tools are executed in main (broker/handlers for `workspace.write` / `workspace.update`):
- After successful fs operation: notify SddTraceService with file path + before/after hashes + actor=agent

### Preload
- Expose `window.api.sdd.*` methods and `window.api.sdd.onChange(handler)` event subscription.
- No extra privileges beyond `ipcRenderer.invoke/on`.

### Renderer

#### New UI panel
- `apps/electron-shell/src/renderer/components/panels/SddPanel.tsx`
  - Feature/task tree view
  - Start/stop run controls
  - Parity meter + drift list
  - File trace lookup view (by selected file)
  - Disabled state when `sdd.enabled` is false

#### Integrations
- FileTree + EditorTabBar add provenance badges:
  - “Tracked” (feature/task) or “Untracked”
  - Click → opens File Trace view in SDD panel
- Settings panel adds an SDD category with a toggle for `sdd.enabled` and the commit enforcement flag

---

## Interfaces / contracts (packages/api-contracts)

### IPC channels
Add to `packages/api-contracts/src/ipc-channels.ts`:

- `sdd:list-features`
- `sdd:status`
- `sdd:start-run`
- `sdd:stop-run`
- `sdd:set-active-task`
- `sdd:get-file-trace`
- `sdd:get-task-trace`
- `sdd:get-parity`
- `sdd:override-untracked` (optional, if enforcement enabled)
- `sdd:changed` (event channel, renderer subscribes)

### Zod schemas (types)
Create `packages/api-contracts/src/types/sdd.ts`:

- `SddDocRef { path, hash }`
- `SddStartRunRequest { featureId, taskId, inputs: SddDocRef[] }`
- `SddRun { runId, featureId, taskId, startedAt, stoppedAt, status }`
- `SddEvent` union (for persistence/internal use; UI receives sanitized subset only)
- `SddParity { trackedFileChanges, untrackedFileChanges, trackedRatio, driftFiles, staleDocs }`
- `SddStatus { activeRun, parity }`
- `SddCommitCheckResult { allowed, reason?, untrackedFiles?, driftFiles? }`

Update `packages/api-contracts/src/types/settings.ts`:
- `SddSettings { enabled: boolean; blockCommitOnUntrackedCodeChanges: boolean }`
- include `sdd` in `SettingsSchema` + `SETTINGS_DEFAULTS`

### Preload API additions
Update `packages/api-contracts/src/preload-api.ts`:

~~~ts
sdd: {
  listFeatures(): Promise<{ featureId: string; specPath: string; planPath?: string; tasksPath?: string }[]>;
  status(): Promise<SddStatus>;
  startRun(req: SddStartRunRequest): Promise<SddRun>;
  stopRun(): Promise<void>;
  setActiveTask(featureId: string, taskId: string): Promise<void>;
  getFileTrace(path: string): Promise<{ path: string; runs: SddRun[] }>;
  getTaskTrace(featureId: string, taskId: string): Promise<{ files: string[]; runs: SddRun[] }>;
  onChange(handler: (_event: Electron.IpcRendererEvent, status: SddStatus) => void): void;
  overrideUntracked?(reason: string): Promise<void>;
}
~~~

---

## Data model changes

### Workspace files
- `.ai-shell/sdd/trace.jsonl` (append-only)
- `.ai-shell/sdd/index.json` (materialized)
- `.ai-shell/sdd/config.json` (optional; falls back to defaults)

### Ledger event format (v1)
Each line is a JSON object with:

- `v`: schema version
- `ts`: ISO timestamp
- `type`: event type, e.g.
  - `RUN_STARTED`, `RUN_STOPPED`, `RUN_ABORTED`
  - `FILE_MODIFIED`, `FILE_ADDED`, `FILE_DELETED`, `FILE_RENAMED`
  - `UNTRACKED_CHANGE_DETECTED`
  - `COMMIT_BLOCKED`, `COMMIT_OVERRIDDEN`, `COMMIT_SUCCEEDED`
- `actor`: `human` or `agent:<name>`
- `run`: optional `{ runId, featureId, taskId }`
- `docRefs`: optional, primarily on `RUN_STARTED` (and optionally `RUN_STOPPED`)
  - array of `{ path, hash }` for constitution/spec/plan/tasks inputs
- `files`: optional
  - array of `{ path, op, hash_before?, hash_after }`
- `meta`: optional, small, non-secret
  - e.g. debounce batch size, index rebuild duration, watcher source

**Rules**
- No file contents, no prompts, no secrets.
- Hashes are content hashes computed in main.

### Index shape (v1)
- `schemaVersion`: number
- `runsById`: record of `runId -> { run metadata }`
- `fileToRuns`: record of `path -> runId[]` (most recent first)
- `taskToFiles`: record of `featureId/taskId -> path[]`
- `latestParitySnapshot`: `{ trackedFileChanges, untrackedFileChanges, trackedRatio, driftFiles, staleDocs, updatedAt }`

---

## Migrations and compatibility

### First run initialization
- On workspace open:
  - Ensure `.ai-shell/sdd/` exists
  - If no ledger: create empty `.ai-shell/sdd/trace.jsonl`
  - If no index: build `.ai-shell/sdd/index.json` from ledger

### Schema evolution
- Every ledger line includes `v`.
- Index includes `schemaVersion`.
- On version mismatch:
  - Rebuild index from ledger applying known migrations
  - Never rewrite old ledger lines (append-only invariant)

### Crash safety
- Ledger writes are append + flush
- If app exits during a run, on next start:
  - Mark previous active run as `RUN_ABORTED` with last-known info (no guesses beyond what is known)

---

## Test strategy

### Unit tests (main)
**SddTraceService**
- start/stop run writes correct events and updates index
- file change attribution with active run → tracked
- file change without active run → untracked + drift list
- parity computation correctness (tracked/untracked ratio, drift/stale)
- path validation (reject outside workspace, `..` traversal attempts)
- rebuild index from ledger produces stable results

**SddWatcher**
- debouncing batches events
- ignores paths outside configured track roots
- handles rename/delete scenarios
- handles large bursts (branch switch) without event storms

**GitService integration**
- commit blocked when policy enabled and untracked exists
- override creates `COMMIT_OVERRIDDEN` (or `OVERRIDE_UNTRACKED`) ledger event and then allows commit

### Renderer tests
- SDD panel renders status + tasks and reacts to `sdd:changed`
- badges render "Tracked/Untracked" and open trace view
- all SDD behavior is mocked via `window.api.sdd.*` (P1 compliance)
- settings UI toggles `sdd.enabled` and exposes commit enforcement

### E2E (Playwright)
- Start run → edit file via UI → parity shows tracked
- Edit file without run → parity shows untracked
- Commit attempt with enforcement enabled → blocked and UI shows reason + untracked files

---

## Rollout plan

### Phase 0 (dev-only)
- Implement service + ledger + minimal `status()` API
- Hidden behind feature flag: `sdd.enabled` (default false)

### Phase 1 (user-visible MVP)
- SDD panel + parity meter
- watcher enabled (debounced, allowlist)
- agent tool attribution enabled
- commit enforcement default off

### Phase 2 (enforcement + polish)
- optional commit block + override UI
- provenance badges in explorer/tabs
- better task parsing (stable IDs) and richer trace views (task → files → runs)

---

## Observability

### Local, non-secret metrics (in ledger + optional logs)
- index rebuild duration (ms)
- watcher batch size (files/events per batch)
- parity snapshot counts + time
- number of tracked/untracked changes
- commit block counts (if enabled)

### UI surfacing
- Parity meter shows:
  - tracked/untracked counts + ratio
  - drift files list (click to open)
  - stale docs list (click to open)

---

## Security checklist (must-pass)

- [ ] P1: renderer has no fs access; all trace I/O and watcher in main
- [ ] P2: no dangerous Electron flags introduced (no `webSecurity:false`, etc.)
- [ ] P3: ledger contains no secrets, no file contents, no prompts
- [ ] P6: IPC channels + payloads defined in `packages/api-contracts` and validated with Zod
- [ ] Workspace boundary enforcement identical to FsBrokerService (resolve + startsWith)
- [ ] Watcher scoped to workspace and allowlisted roots only
- [ ] Renderer receives sanitized status only (no content; no sensitive metadata)
- [ ] Event stream throttled/debounced to prevent UI DoS
- [ ] Commit enforcement is configurable and defaults to non-blocking in initial rollout
