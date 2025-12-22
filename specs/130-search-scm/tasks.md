# 130 Workspace Search + SCM - Implementation Tasks

## Task 1: Add contracts and IPC channels
**Files to modify:**
- `packages/api-contracts/src/types/search.ts` (new)
- `packages/api-contracts/src/types/scm.ts` (new)
- `packages/api-contracts/src/index.ts`
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`

**Description:**
Define Zod schemas for search/replace and SCM operations, add IPC channels,
and expose preload API methods.

**Verification:**
```bash
pnpm -C packages/api-contracts test
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** All IPC requests/responses are Zod schemas.
- **P1 (Process isolation):** No OS access from renderer contracts.

---

## Task 2: Implement main SearchService + IPC handlers
**Files to create:**
- `apps/electron-shell/src/main/services/SearchService.ts`

**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts`

**Description:**
Implement `rg`-backed search and replacement in the main process, validate
workspace boundaries, enforce max results, and wire IPC handlers.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Search execution occurs in main only.
- **P2 (Security defaults):** No raw shell access in renderer.

---

## Task 3: Implement main GitService + IPC handlers
**Files to create:**
- `apps/electron-shell/src/main/services/GitService.ts`

**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts`

**Description:**
Implement Git status parsing, stage/unstage, and commit operations using main
process commands. Handle non-repo workspaces with a clean empty state.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Git commands run in main only.
- **P3 (Secrets):** No remote Git operations; no credentials logged.

---

## Task 4: Add renderer Search panel
**Files to create:**
- `apps/electron-shell/src/renderer/components/search/SearchPanel.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx`
- `apps/electron-shell/src/renderer/App.tsx`

**Description:**
Add Search panel UI and wire it to IPC. Integrate into activity bar selection
and primary sidebar routing.
Use Tailwind 4 tokens and prefer `packages/ui-kit` primitives for layout and controls.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/renderer/components/search/SearchPanel.test.tsx
```

**Invariants (Constitution):**
- **P4 (UI design system):** Use Tailwind 4 tokens only.
- **P2 (Security defaults):** Use preload API only.

---

## Task 5: Add renderer Source Control panel
**Files to create:**
- `apps/electron-shell/src/renderer/components/scm/SourceControlPanel.tsx`

**Files to modify:**
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx`
- `apps/electron-shell/src/renderer/App.tsx`

**Description:**
Add SCM UI (status, stage/unstage, commit). Wire to IPC and integrate into
activity bar selection.
Use Tailwind 4 tokens and prefer `packages/ui-kit` primitives for layout and controls.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/renderer/components/scm/SourceControlPanel.test.tsx
```

**Invariants (Constitution):**
- **P4 (UI design system):** Use Tailwind 4 tokens only.
- **P1 (Process isolation):** No direct git access in renderer.

---

## Task 6: Update docs and QA checklist
**Files to modify:**
- `docs/architecture/architecture.md`
- `specs/130-search-scm/spec.md` (if scope changes)

**Description:**
Document search/SCM data flow, IPC contracts, and main-process responsibilities.

**Verification:**
```bash
pnpm lint
```

---

## Task 7: Harden workspace path validation (realpath)
**Files to create:**
- `apps/electron-shell/src/main/services/workspace-paths.ts`

**Files to modify:**
- `apps/electron-shell/src/main/services/FsBrokerService.ts`
- `apps/electron-shell/src/main/services/SearchService.ts`
- `apps/electron-shell/src/main/services/FsBrokerService.test.ts`
- `apps/electron-shell/src/main/services/SearchService.test.ts`
- `packages/api-contracts/src/ipc-channels.ts` (remove control character)

**Description:**
Introduce a shared workspace path validation helper using `fs.realpath` to
prevent symlink escapes. Apply it to FsBrokerService and SearchService
search/replace flows. Clean the stray 0x1A control character in IPC docs.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/main/services/FsBrokerService.test.ts
pnpm -C apps/electron-shell test src/main/services/SearchService.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Workspace validation stays in main.
- **P2 (Security defaults):** Prevent path traversal and symlink escapes.

---

## Task 8: Harden TerminalService cwd validation
**Files to modify:**
- `apps/electron-shell/src/main/services/TerminalService.ts`
- `apps/electron-shell/src/main/services/TerminalService.test.ts`

**Description:**
Use separator-aware checks and realpath to ensure terminal cwd cannot escape
the workspace (including prefix and symlink cases). Add regression test.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/main/services/TerminalService.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Terminal spawn stays in main.
- **P2 (Security defaults):** Enforce workspace boundaries.

---

## Task 9: Allowlist child-process environment
**Files to create:**
- `apps/electron-shell/src/main/services/child-env.ts`

**Files to modify:**
- `apps/electron-shell/src/main/services/extension-host-manager.ts`
- `apps/electron-shell/src/main/services/agent-host-manager.ts`
- `apps/electron-shell/src/main/services/extension-host-manager.test.ts`
- `apps/electron-shell/src/main/services/agent-host-manager.test.ts`
- `docs/architecture/architecture.md`

**Description:**
Allowlist/sanitize environment variables passed to Extension Host and Agent Host
processes, and document the exposed env surface.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/main/services/extension-host-manager.test.ts
pnpm -C apps/electron-shell test src/main/services/agent-host-manager.test.ts
```

**Invariants (Constitution):**
- **P1 (Process isolation):** Child processes run outside renderer.
- **P3 (Secrets):** Avoid leaking secrets via env.

---

## Task 10: Fix preload menu IPC listener bookkeeping
**Files to modify:**
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/preload/index.test.ts`

**Description:**
Track wrapper functions for menu IPC listeners so cleanup removes the correct
handlers without removing unrelated listeners. Add a preload unit test.

**Verification:**
```bash
pnpm -C apps/electron-shell test src/preload/index.test.ts
```

**Invariants (Constitution):**
- **P2 (Security defaults):** Preload stays minimal and safe.

---

## Task 11: Add GitService tests + Search/SCM UI coverage
**Files to create:**
- `apps/electron-shell/src/main/services/GitService.test.ts`
- `apps/electron-shell/src/renderer/components/search/SearchPanel.test.tsx`
- `apps/electron-shell/src/renderer/components/scm/SourceControlPanel.test.tsx`
- `test/e2e/search-scm.spec.ts`

**Description:**
Add unit tests for GitService behavior and minimal renderer + e2e coverage
for Search and SCM panels (empty states + basic rendering).

**Verification:**
```bash
pnpm -C apps/electron-shell test src/main/services/GitService.test.ts
pnpm -C apps/electron-shell test src/renderer/components/search/SearchPanel.test.tsx
pnpm -C apps/electron-shell test src/renderer/components/scm/SourceControlPanel.test.tsx
pnpm test:e2e -- --project=chromium
```

**Invariants (Constitution):**
- **P1 (Process isolation):** No direct OS access in renderer tests.
