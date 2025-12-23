## Task 1: Add Spec Drvien Development (SDD) contracts, IPC channels, settings schema, and layout icon support
**Files to create:**
- `packages/api-contracts/src/types/sdd.ts`

**Files to modify:**
- `packages/api-contracts/src/index.ts`
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/types/layout-state.ts` (if adding an Activity Bar icon)
- `packages/api-contracts/src/types/settings.ts`

**Description:**
Define Zod schemas for SDD runs, parity, events, and commit checks. Add IPC
channels (including `sdd:changed`) and preload API methods. Add `SddSettings`
with `sdd.enabled` and `sdd.blockCommitOnUntrackedCodeChanges` (both default
false). If the SDD panel is exposed via Activity Bar, extend layout state icon
enum to include the new id.

**Verification:**
```pws
pnpm -C packages/api-contracts test
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** All IPC requests/responses are Zod schemas.
- **P1 (Process isolation):** No OS access from renderer contracts.

---

## Task 2: Surface SDD toggles in Settings (persistence + UI)
**Files to modify:**
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.test.tsx`
- `apps/electron-shell/src/main/services/SettingsService.test.ts`

**Description:**
Add an SDD settings category and toggle controls for `sdd.enabled` and
`sdd.blockCommitOnUntrackedCodeChanges`. Wire to `window.api.updateSettings`
with the existing debounce, and ensure defaults/validation are covered in
SettingsService tests. Capture a screenshot for visual diff (store under
`docs/images/` with a clear SDD filename).

**Verification:**
```pws
pnpm -C apps/electron-shell test src/renderer/components/settings/SettingsPanel.test.tsx
pnpm -C apps/electron-shell test src/main/services/SettingsService.test.ts
```

**Invariants (Constitution):**
- **P4 (UI design system):** Tailwind tokens + ui-kit primitives only.
- **P1 (Process isolation):** Renderer uses preload API only.

---

## Task 3: Implement SddTraceService (ledger + index) with settings gating
**Files to create:**
- `apps/electron-shell/src/main/services/SddTraceService.ts`
- `apps/electron-shell/src/main/services/SddTraceService.test.ts`

**Description:**
Implement append-only ledger writing and index materialization under
`.ai-shell/sdd/`. Track run lifecycle, file change metadata, and parity
snapshots. Use workspace path validation helper and content hashing in main.
Add explicit enable/disable handling so `sdd.enabled = false` ends any active
run and skips new events.

**Verification:**
```pws
pnpm -C apps/electron-shell test src/main/services/SddTraceService.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** All fs I/O in main only.
- **P2/P3 (Security):** Store metadata + hashes only (no contents or secrets).

---

## Task 4: Add SddWatcher for workspace changes
**Files to create:**
- `apps/electron-shell/src/main/services/SddWatcher.ts`
- `apps/electron-shell/src/main/services/SddWatcher.test.ts`

**Description:**
Implement debounced workspace file watching, scoped to configured roots and
workspace boundaries. Emit FILE_* or UNTRACKED_* events into SddTraceService
and handle bulk change batching. Ensure the watcher stops when `sdd.enabled`
turns false and resumes cleanly when re-enabled.

**Verification:**
```pws
pnpm -C apps/electron-shell test src/main/services/SddWatcher.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Watcher lives in main.
- **P2 (Security defaults):** Enforce workspace boundaries + allowlist roots.

---

## Task 5: Wire SDD IPC handlers, settings hook, and event stream
**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/main/index.ts` (service initialization)

**Description:**
Expose SDD actions and queries via IPC (`list-features`, `start-run`, `stop-run`,
`status`, `get-file-trace`, `get-task-trace`, `get-parity`, `override-untracked`).
Emit `sdd:changed` events to renderer with sanitized status payloads. When
settings updates flip `sdd.enabled`, notify SddTraceService to stop/resume
watchers and end active runs as needed.

**Verification:**
```pws
pnpm -C apps/electron-shell test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** IPC uses api-contracts schemas.
- **P1 (Process isolation):** Renderer never touches fs directly.

---

## Task 6: Agent tool attribution
**Files to modify:**
- `apps/electron-shell/src/main/services/agent-host-manager.ts` (or tool handlers)
- `packages/broker-main/src/index.ts` (if tool hooks live here)

**Description:**
After successful `workspace.write` / `workspace.update` operations, notify
SddTraceService with actor=agent and before/after hashes so agent edits are
automatically traced.

**Verification:**
```pws
pnpm -C apps/electron-shell test src/main/services/agent-host-manager.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Attribution occurs in main only.
- **P6 (Contracts-first):** Tool payloads remain schema-validated.

---

## Task 7: GitService enforcement hook
**Files to modify:**
- `apps/electron-shell/src/main/services/GitService.ts`
- `apps/electron-shell/src/main/services/GitService.test.ts`
- `packages/api-contracts/src/types/scm.ts` (if commit response changes)

**Description:**
Integrate SddTraceService parity checks into `scm:commit` when
`sdd.blockCommitOnUntrackedCodeChanges` is enabled. Return a structured
contract response or error for blocked commits and record override events when
allowed by policy.

**Verification:**
```pws
pnpm -C apps/electron-shell test src/main/services/GitService.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Git checks run in main only.
- **P3 (Secrets):** No credentials recorded in ledger or logs.

---

## Task 8: Expose preload SDD API
**Files to modify:**
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/renderer/vite-env.d.ts`

**Description:**
Expose `window.api.sdd.*` methods and a sanitized `onChange` subscription in
preload, using the contracts-first IPC channels.

**Verification:**
```pws
pnpm -C apps/electron-shell test src/preload/index.test.ts
```

**Invariants (Constitution):**
- **P2 (Security defaults):** Preload stays minimal and whitelisted.

---

## Task 9: Add SDD panel UI + provenance badges
**Files to create:**
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.tsx`
- `apps/electron-shell/src/renderer/components/sdd/SddPanel.test.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/App.tsx`
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx`
- `apps/electron-shell/src/renderer/components/editor/EditorTabBar.tsx`
- `apps/electron-shell/src/renderer/components/explorer/FileTree.tsx`
- `packages/ui-kit/src/components/ActivityBar.tsx` (if adding Activity Bar icon)

**Description:**
Implement SDD panel (feature/task selection, start/stop run, parity meter,
file trace view) and provenance badges in explorer/tabs. Wire to `window.api.sdd`.
Honor `sdd.enabled` with a disabled state in the panel. Capture screenshots for
all UI changes (store under `docs/images/` with clear SDD filenames).

**Verification:**
```pws
pnpm -C apps/electron-shell test src/renderer/components/sdd/SddPanel.test.tsx
```

**Invariants (Constitution):**
- **P4 (UI design system):** Tailwind tokens + ui-kit primitives only.
- **P1 (Process isolation):** Renderer uses preload API only.

---

## Task 10: E2E flows for SDD
**Files to create:**
- `test/e2e/sdd.spec.ts`

**Description:**
Add Playwright coverage for: enable SDD in Settings, start run -> edit file ->
tracked parity, edit without run -> untracked parity, and commit block when
enforcement is enabled.

**Verification:**
```pws
pnpm test:e2e -- --project=chromium
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Renderer remains sandboxed.

---

## Task 11: Update architecture docs
**Files to modify:**
- `docs/architecture/architecture.md`
- `specs/140-sdd/spec.md` (if scope changes)

**Description:**
Document SDD data flow, main-process responsibilities, IPC contracts, settings
controls, and parity enforcement behavior.

**Verification:**
```pws
pnpm lint
```
