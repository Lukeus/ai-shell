# 050 Terminal + Logs + Problems — Implementation Tasks

## Task 1: Define IPC contracts for Terminal/Output/Diagnostics
**Status:** ✅ Completed

**Files to create:**
- `packages/api-contracts/src/types/terminal.ts`
- `packages/api-contracts/src/types/output.ts`
- `packages/api-contracts/src/types/diagnostics.ts`

**Files to modify:**
- `packages/api-contracts/src/ipc-channels.ts` (add TERMINAL_*, OUTPUT_*, DIAGNOSTICS_* channels)
- `packages/api-contracts/src/preload-api.ts` (add terminal, output, diagnostics APIs)
- `packages/api-contracts/src/index.ts` (export new types)

**Description:**
Define all Zod schemas for terminal PTY operations, output channels, and diagnostics. Add IPC channel constants and PreloadAPI interface extensions. This MUST be completed before any implementation work.

**Verification:**
```bash
cd packages/api-contracts
pnpm typecheck
pnpm lint
pnpm test
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** All IPC contracts defined in api-contracts with Zod schemas BEFORE implementation
- **P1 (Process Isolation):** PreloadAPI only exposes safe APIs; no Node access in renderer

---

## Task 2: Add dependencies for terminal, output, and UI components
**Status:** ✅ Completed
**Note:** node-pty added as optionalDependency (requires Visual Studio Build Tools on Windows for native compilation)

**Files to modify:**
- `apps/electron-shell/package.json` (add node-pty, xterm, xterm-addon-fit, xterm-addon-webgl)
- `packages/ui-kit/package.json` (add @tanstack/react-virtual)

**Description:**
Add dependencies for PTY backend (node-pty), terminal UI (xterm.js + addons), and virtualized lists (@tanstack/react-virtual). Run pnpm install to install dependencies.

**Verification:**
```bash
pnpm install
pnpm -r typecheck
```

**Invariants (Constitution):**
- **P5 (Performance Budgets):** xterm.js will be lazy-loaded; verify it's NOT in initial bundle after implementation

---

## Task 3: Implement TerminalService in main process
**Status:** ✅ Completed

**Files to create:**
- `apps/electron-shell/src/main/services/TerminalService.ts`
- `apps/electron-shell/src/main/services/TerminalService.test.ts`

**Description:**
Implement TerminalService to manage PTY sessions using node-pty. Include security validations: cwd restricted to workspace, environment sanitization, session ID validation, max 10 concurrent sessions. **CRITICAL: DO NOT LOG TERMINAL I/O** (may contain secrets).

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/services/TerminalService.test.ts
# Manual verification: grep for console.log/logger in TerminalService.ts (MUST be 0 results)
```

**Invariants (Constitution):**
- **P1 (Process Isolation):** TerminalService runs ONLY in main process; uses node-pty for OS-level PTY
- **P3 (Secrets):** NEVER log terminal I/O (may contain passwords, API keys)
- **P2 (Security Defaults):** Validate all inputs, restrict cwd to workspace, sanitize env vars

---

## Task 4: Register terminal IPC handlers in main process
**Status:** ✅ Completed

**Files to modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts` (add TERMINAL_* IPC handlers)
- `apps/electron-shell/src/main/index.ts` (import and instantiate terminalService)
- `apps/electron-shell/src/main/ipc-handlers.test.ts` (add tests for terminal IPC handlers)

**Description:**
Register IPC handlers for TERMINAL_CREATE, TERMINAL_WRITE, TERMINAL_RESIZE, TERMINAL_CLOSE. Validate all requests with Zod schemas. Wire up TerminalService to IPC handlers.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/main/ipc-handlers.test.ts
```

**Invariants (Constitution):**
- **P6 (Contracts-first):** All IPC requests validated with Zod schemas from api-contracts
- **P1 (Process Isolation):** IPC handlers run in main process only

---

## Task 5: Expose terminal APIs in preload script
**Status:** ✅ Completed

**Files to modify:**
- `apps/electron-shell/src/preload/index.ts` (add terminal, output, diagnostics to contextBridge)

**Description:**
Expose terminal/output/diagnostics APIs via contextBridge. Implement onData/onExit event subscriptions with proper cleanup (removeListener). Ensure PreloadAPI type safety.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
```

**Invariants (Constitution):**
- **P2 (Security Defaults):** Minimal preload API via contextBridge; no Node access exposed to renderer
- **P1 (Process Isolation):** Preload only bridges IPC; no OS access

---

## Task 6: Build UI-Kit TabBar and VirtualizedList components
**Status:** ✅ Completed

**Files to create:**
- `packages/ui-kit/src/components/TabBar.tsx`
- `packages/ui-kit/src/components/TabBar.test.tsx`
- `packages/ui-kit/src/components/VirtualizedList.tsx`
- `packages/ui-kit/src/components/VirtualizedList.test.tsx`

**Files to modify:**
- `packages/ui-kit/src/index.ts` (export TabBar, VirtualizedList)

**Description:**
Build reusable TabBar component for horizontal tab navigation with active state. Build VirtualizedList wrapper around @tanstack/react-virtual for Output/Problems (handles 10K+ items). Use Tailwind 4 tokens.

**Verification:**
```bash
cd packages/ui-kit
pnpm typecheck
pnpm lint
pnpm test
```

**Invariants (Constitution):**
- **P4 (UI Design System):** Use Tailwind 4 tokens; no hardcoded colors

---

## Task 7: Update BottomPanel with tab bar and view switching
**Status:** ✅ Completed

**Files to modify:**
- `apps/electron-shell/src/renderer/components/layout/BottomPanel.tsx` (replace placeholder with TabBar + views)

**Description:**
Replace placeholder BottomPanel content with TabBar component. Implement tab switching logic (Terminal, Output, Problems). Persist active tab to localStorage scoped per workspace.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/layout/BottomPanel.test.tsx
```

**Invariants (Constitution):**
- **P4 (UI Design System):** Use Tailwind 4 tokens for styling
- **P1 (Process Isolation):** Renderer uses only localStorage; no Node/OS access

---

## Task 8: Implement TerminalContext and terminal state management
**Status:** ✅ Completed

**Files to create:**
- `apps/electron-shell/src/renderer/contexts/TerminalContext.tsx`
- `apps/electron-shell/src/renderer/contexts/TerminalContext.test.tsx`

**Description:**
Implement TerminalContext for terminal session state management. Track active sessions, handle creation/close, persist metadata to localStorage. Subscribe to terminal data/exit events via window.api.terminal.onData/onExit. Implement proper event cleanup.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/contexts/TerminalContext.test.tsx
```

**Invariants (Constitution):**
- **P1 (Process Isolation):** Context calls window.api.terminal (IPC); no Node access
- **P2 (Security Defaults):** Event listeners properly cleaned up (removeListener on unmount)

---

## Task 9: Implement Terminal components with xterm.js lazy loading
**Status:** ⬜ Not Started

**Files to create:**
- `apps/electron-shell/src/renderer/components/terminal/TerminalView.tsx`
- `apps/electron-shell/src/renderer/components/terminal/Terminal.tsx`
- `apps/electron-shell/src/renderer/components/terminal/TerminalLoader.tsx`
- `apps/electron-shell/src/renderer/components/terminal/TerminalSessionTabs.tsx`
- `apps/electron-shell/src/renderer/components/terminal/useTerminal.tsx`
- `apps/electron-shell/src/renderer/components/terminal/TerminalView.test.tsx`
- `apps/electron-shell/src/renderer/components/terminal/Terminal.test.tsx`

**Description:**
Implement terminal UI components. TerminalView lazy-loads xterm.js via dynamic import (following Monaco pattern). Terminal.tsx wraps xterm.js instance, handles input/output via IPC. TerminalLoader shows spinner during load. TerminalSessionTabs manages sub-tabs.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/terminal/
pnpm build
# Verify xterm.js in separate chunk (NOT in main bundle):
# Check dist/renderer/*.js for terminal-<hash>.js chunk
```

**Invariants (Constitution):**
- **P5 (Performance Budgets):** xterm.js MUST be lazy-loaded; excluded from initial renderer bundle
- **P1 (Process Isolation):** Terminal sends/receives data via window.api.terminal (IPC); no Node access
- **P4 (UI Design System):** Use Tailwind 4 tokens

---

## Task 10: Implement Output components with virtualization
**Status:** ⬜ Not Started

**Files to create:**
- `apps/electron-shell/src/renderer/components/output/OutputView.tsx`
- `apps/electron-shell/src/renderer/components/output/OutputViewer.tsx`
- `apps/electron-shell/src/renderer/components/output/OutputChannelSelector.tsx`
- `apps/electron-shell/src/renderer/components/output/OutputView.test.tsx`

**Description:**
Implement output viewer components. OutputView container with channel dropdown. OutputViewer uses VirtualizedList from ui-kit to handle 10K+ lines. Implement auto-scroll with manual override detection. Subscribe to window.api.output.onAppend events.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/output/
```

**Invariants (Constitution):**
- **P1 (Process Isolation):** Output viewer subscribes to IPC events; no Node access
- **P4 (UI Design System):** Use Tailwind 4 tokens

---

## Task 11: Implement Problems components with virtualization
**Status:** ⬜ Not Started

**Files to create:**
- `apps/electron-shell/src/renderer/components/problems/ProblemsView.tsx`
- `apps/electron-shell/src/renderer/components/problems/ProblemsTable.tsx`
- `apps/electron-shell/src/renderer/components/problems/DiagnosticRow.tsx`
- `apps/electron-shell/src/renderer/components/problems/ProblemsView.test.tsx`

**Description:**
Implement problems panel components. ProblemsView container with summary header. ProblemsTable uses VirtualizedList to handle 1000+ diagnostics. DiagnosticRow displays severity icon, message, file, line, source. Subscribe to window.api.diagnostics.onUpdate events. Sort by severity.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test src/renderer/components/problems/
```

**Invariants (Constitution):**
- **P1 (Process Isolation):** Problems panel subscribes to IPC events; no Node access
- **P4 (UI Design System):** Use Tailwind 4 tokens

---

## Task 12: Wire up Terminal/Output/Problems views to BottomPanel
**Status:** ⬜ Not Started

**Files to modify:**
- `apps/electron-shell/src/renderer/components/layout/BottomPanel.tsx` (import and render Terminal/Output/Problems views)
- `apps/electron-shell/src/renderer/App.tsx` (wrap with TerminalContext provider if needed)

**Description:**
Import TerminalView, OutputView, ProblemsView and wire them to BottomPanel tabs. Ensure TerminalContext is provided at app level. Test tab switching and view rendering.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm test
pnpm dev
# Manual verification: Open app, click Terminal/Output/Problems tabs, verify views render
```

**Invariants (Constitution):**
- **P4 (UI Design System):** Use Tailwind 4 tokens consistently across all views

---

## Task 13: Add E2E tests for terminal, output, and problems
**Status:** ⬜ Not Started

**Files to create:**
- `test/e2e/terminal.spec.ts`
- `test/e2e/output.spec.ts`
- `test/e2e/problems.spec.ts`

**Description:**
Write Playwright E2E tests covering: create terminal session, type command and see output, create multiple sessions, close session, session persistence. Test output tab switching and auto-scroll. Test problems tab rendering and mock diagnostics display.

**Verification:**
```bash
pnpm test:e2e
```

**Invariants (Constitution):**
- All E2E tests pass before merging

---

## Task 14: Add mock data for Output and Problems panels
**Status:** ⬜ Not Started

**Files to modify:**
- `apps/electron-shell/src/renderer/components/output/OutputView.tsx` (add mock "Build" channel output)
- `apps/electron-shell/src/renderer/components/problems/ProblemsView.tsx` (add mock TypeScript/ESLint diagnostics)

**Description:**
Add placeholder mock data for Output panel ("Build" channel with sample output) and Problems panel (mock TypeScript errors, ESLint warnings). This demonstrates UI functionality until real integrations are implemented.

**Verification:**
```bash
cd apps/electron-shell
pnpm typecheck
pnpm lint
pnpm dev
# Manual verification: Open Output tab, see mock build output. Open Problems tab, see mock diagnostics.
```

**Invariants (Constitution):**
- **P1 (Process Isolation):** Mock data is renderer-side only; no OS access

---

## Task 15: Final verification and build analysis
**Status:** ⬜ Not Started

**Files to verify:**
- All files in feature

**Description:**
Run full test suite, lint, typecheck, and build. Verify xterm.js is in separate lazy chunk (NOT in initial renderer bundle). Verify all acceptance criteria met. Manual QA: create terminals, type commands, see output, close sessions, restart app, verify persistence.

**Verification:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
# Build verification: Check that xterm.js is in separate chunk
# Should see terminal-<hash>.js in apps/electron-shell/dist/renderer/
# Manual QA: pnpm dev → test all functionality
```

**Invariants (Constitution):**
- **P5 (Performance Budgets):** xterm.js excluded from initial renderer bundle (lazy-loaded)
- **P6 (Contracts-first):** All IPC contracts defined in api-contracts
- **P1 (Process Isolation):** PTY operations in main only; renderer sandboxed
- **P3 (Secrets):** Terminal I/O NOT logged anywhere
- **P4 (UI Design System):** Tailwind 4 tokens used consistently

---

## Summary

**Total tasks:** 15
**Estimated order:** Sequential (1→15), with some parallelization possible after Task 5

**Critical path:**
1. Contracts (Task 1) → Dependencies (Task 2) → Main process (Tasks 3-4) → Preload (Task 5) → UI (Tasks 6-12) → Tests (Tasks 13-14) → Verification (Task 15)

**Key invariants to maintain:**
- **P1:** Main process owns OS/PTY; renderer sandboxed
- **P3:** NEVER log terminal I/O
- **P5:** xterm.js lazy-loaded (separate chunk)
- **P6:** Contracts-first (Zod schemas in api-contracts)
- **P4:** Tailwind 4 tokens only
