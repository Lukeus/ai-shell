# SDD Traceability + Parity (ai-shell)

## Goals

1. **First-class SDD workflow in the IDE**
   - Users can browse `constitution → spec → plan → tasks` inside ai-shell and start/stop work on a specific task without leaving the app.

2. **Deterministic provenance**
   - The system can answer: “Which code files were derived from which constitution/spec/plan/tasks (and which task run)?” using a **machine-readable ledger** as the source of truth.

3. **Parity measurement**
   - Provide a **Parity Meter** that quantifies traceability and drift:
     - tracked vs untracked code changes
     - stale docs vs code
     - unlinked changes since last run

4. **Enforcement hooks**
   - Support optional policy that blocks commits (or requires explicit override) when code changes are untracked.

5. **Constitution compliance**
   - P1: renderer stays sandboxed; provenance logic and filesystem activity live in main.
   - P2/P3: no secrets or plaintext sensitive data recorded; ledger stores only metadata/hashes.
   - P6: contracts-first for all IPC and event schemas.

---

## Non-goals

- Full extension marketplace integration or extension-level SDD enforcement (future).
- Cross-repo / multi-workspace trace aggregation (future).
- Cloud sync of trace data (future).
- Perfect symbol-level provenance (functions/classes) in v1; **file-level is sufficient**.
- Automatic “understanding” of task completion beyond configured checks; humans still decide “done”.

---

## Personas

1. **IC Developer**
   - Wants to follow spec-driven flow without extra ceremony.
   - Needs quick answers: “Where did this file come from?” / “What task is this part of?”

2. **Tech Lead / Reviewer**
   - Wants to validate parity and ensure changes map to documented requirements.
   - Needs CI-enforceable traceability and review UX.

3. **Security/Compliance Stakeholder**
   - Wants auditability without leaking secrets or enabling data exfiltration from renderer/agents.

---

## User stories

1. **Start a task run**
   - As a developer, I can select a task from the SDD panel and click **Start Run** so all subsequent edits are attributed to that task.

2. **See provenance for a file**
   - As a developer, I can open a file and see which feature/task/run it came from.

3. **Detect untracked changes**
   - As a developer, I see a warning when I have modified code files without an active task run.

4. **Measure parity**
   - As a lead, I can view a parity summary per feature and for the current workspace.

5. **Enforce parity on commit**
   - As a lead, I can enable “block commit if untracked code changes exist” so parity is enforced.

6. **Agent-generated changes are automatically traced**
   - As a developer, when an agent uses workspace tools to edit files, those edits are recorded as derived from the active task run.

7. **Enable or disable SDD**
   - As a developer, I can toggle SDD in Settings to turn tracing/parity on or off.

---

## Acceptance criteria

### A. Storage + provenance
- A1. Trace data is stored in-workspace under:
  - `.ai-shell/sdd/trace.jsonl` (append-only events)
  - `.ai-shell/sdd/index.json` (materialized index for fast UI queries)
- A2. Trace events include:
  - timestamp, actor (human/agent), featureId, taskId, runId
  - inputs: doc refs (paths + hashes) for constitution/spec/plan/tasks
  - outputs: changed file paths + before/after hash (or after hash if new)
- A3. No file contents, prompts, or secrets are written to the ledger.

### B. Main-process enforcement + security
- B1. All fs I/O and watchers are **main-process only**.
- B2. Renderer accesses SDD only via `window.api.sdd.*` contracts-first IPC.
- B3. Paths are validated and constrained to workspace boundaries (same standard as FsBrokerService).

### C. UX
- C1. SDD panel exists (activity bar icon or other first-class entry) showing:
  - feature list and tasks list
  - active run state (running/not running; feature/task)
  - parity meter summary (tracked/untracked/drift/stale)
- C2. File explorer/editor tabs show a small provenance badge:
  - “Tracked (feature/task)” or “Untracked”
- C3. Clicking a badge opens a “File Trace” view with linked runs.

### D. Parity computation
- D1. Parity meter exposes at minimum:
  - trackedFileChanges
  - untrackedFileChanges
  - driftFiles (code changed without run)
  - staleDocs (docs changed without a linked run)
  - trackedRatio = tracked / (tracked + untracked)
- D2. Parity updates on:
  - file changes detected by main watcher
  - agent tool writes/updates
  - start/stop run

### E. Git integration (optional but supported in v1)
- E1. When enabled, `scm:commit` is blocked if untracked code changes exist.
- E2. When blocked, UI shows which files are untracked and offers "Start Run" or "Override with reason".
- E3. Overrides are written as trace events (reason text sanitized; no secrets).

### F. Settings toggle
- F1. SDD is gated behind a settings flag (`sdd.enabled`) and defaults to off.
- F2. When disabled, watchers stop and no new trace events are recorded.
- F3. When re-enabled, the SDD panel and parity meter resume with fresh status.

---

## UX flow

### Flow 1: Start run → edit → stop
1. User opens workspace.
2. User opens SDD panel.
3. User selects a feature + task and clicks **Start Run**.
4. Main creates `runId`, snapshots doc hashes (constitution/spec/plan/tasks), begins attributing edits.
5. User edits files (manual or agent).
6. UI shows files as “Tracked”.
7. User clicks **Stop Run** (or “Mark Done”).
8. Run is finalized; index updated.

### Flow 2: Edit without run
1. User edits a code file without starting a run.
2. Main watcher records `UNTRACKED_CHANGE`.
3. UI parity meter shows untracked changes and highlights files.

### Flow 3: Commit enforcement
1. User attempts to commit.
2. If policy enabled and untracked changes exist:
   - commit is blocked
   - UI provides options:
     - Start Run
     - Override with reason (creates trace event)

---

## Edge cases

- Workspace has no `specs/` folder: SDD panel shows “No specs detected” but still tracks runs if user manually starts one with doc refs.
- Specs exist but task identifiers change (renamed headings/IDs): index supports “superseded” mapping and keeps historical run links.
- Massive file change bursts (git checkout / branch switch): watcher debounces and records a grouped “bulk change” event.
- Binary files changed: hashed and tracked as artifacts, but no content inspection.
- Repo not a git repo: SDD tracking still works; commit enforcement is disabled.
- Multiple windows / processes: SddTraceService is singleton per main process; runs are workspace-scoped.
- Crash during active run: on restart, run is marked "aborted" with last-known state; no data loss beyond the last buffered event.
- SDD disabled while a run is active: run is ended cleanly (stopped or aborted) and watchers pause.

---

## Telemetry (local, non-secret)

Recorded as trace events (and optionally surfaced in UI):
- `RUN_STARTED`, `RUN_STOPPED`, `RUN_ABORTED`
- `FILE_MODIFIED`, `FILE_ADDED`, `FILE_DELETED`
- `UNTRACKED_CHANGE_DETECTED`
- `COMMIT_BLOCKED`, `COMMIT_OVERRIDDEN`, `COMMIT_SUCCEEDED`
- Performance counters: watcher batch size, index rebuild duration

No network telemetry in v1 unless explicitly added later and policy-approved.

---

## Risks

1. **Noise / friction**
   - Too strict enforcement can annoy users. Mitigation: policy is configurable; provide clear UX and override path.

2. **Watcher performance**
   - Large repos may produce many events. Mitigation: debounce + batch events; configurable path allowlist (only track code roots).

3. **Privacy leakage**
   - Accidentally logging content or secrets. Mitigation: enforce schema that only allows metadata + hashes; code review gates.

4. **False attribution**
   - If user forgets to start run, edits are untracked. Mitigation: prompt in UI when first untracked change occurs; quick “Start Run” action.

5. **Spec churn**
   - Tasks/spec headings change. Mitigation: store stable IDs (featureId + taskId string) and keep historical links.

---
