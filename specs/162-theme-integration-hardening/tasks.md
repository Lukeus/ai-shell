# 162 - Theme Integration Hardening - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first: menu event surface
**Files**:
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`

**Work**:
- Add a `menuEvents` (or similarly named) API to `PreloadAPI` with typed subscribe/unsubscribe helpers for:
  - workspace open/close
  - refresh explorer
  - toggle secondary sidebar
- Export any new types from api-contracts.

**Verify**:
- `pnpm --filter packages-api-contracts typecheck`

**Invariants**:
- P6 (Contracts-first)

---

## Task 2 - Preload + renderer: migrate to window.api menu events
**Files**:
- `apps/electron-shell/src/preload/index.ts`
- `apps/electron-shell/src/renderer/App.tsx`
- `apps/electron-shell/src/renderer/vite-env.d.ts`
- `apps/electron-shell/src/renderer/**/*.test.tsx` (if type updates required)

**Work**:
- Implement the new menu events API in preload using `ipcRenderer.on`.
- Replace `window.electron` usage in the renderer with `window.api.menuEvents`.
- Remove or update type definitions referencing `window.electron`.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P2 (Security defaults)
- P6 (Contracts-first)

---

## Task 3 - Theme tokens + Tailwind sources + screenshots
**Files**:
- `apps/electron-shell/src/renderer/styles/globals.css`
- `apps/electron-shell/src/renderer/styles/themes.css` (if needed)
- `packages/ui-kit/src/components/ActivityBar.tsx`
- `packages/ui-kit/src/components/Badge.tsx`
- `packages/ui-kit/src/components/Breadcrumbs.tsx`
- `packages/ui-kit/src/components/CommandPalette.view.tsx`
- `packages/ui-kit/src/components/Input.tsx`
- `packages/ui-kit/src/components/Menu.tsx`
- `packages/ui-kit/src/components/Modal.tsx`
- `packages/ui-kit/src/components/PanelHeader.tsx`
- `packages/ui-kit/src/components/Select.tsx`
- `packages/ui-kit/src/components/ShellLayout.tsx`
- `packages/ui-kit/src/components/StatusBar.tsx`
- `packages/ui-kit/src/components/TabBar.tsx`
- `packages/ui-kit/src/components/ToggleSwitch.tsx`
- `specs/162-theme-integration-hardening/screenshots/` (new)

**Work**:
- Add token aliases for `--color-primary`, `--color-secondary`, `--color-tertiary` to align with `text-primary/secondary/tertiary`.
- Migrate ui-kit chrome components to use semantic `--color-*` tokens for color usage (leave sizing tokens as-is).
- Add Tailwind `@source` entries to include `packages/ui-kit` (and other shared packages if needed).
- Capture a screenshot showing updated theme consistency.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P4 (Token-based theming)
- UI guardrails (no library migration)
- Screenshot requirement

---

## Task 4 - Monaco lazy-load compliance
**Files**:
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.tsx`
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.test.tsx` (if needed)

**Work**:
- Replace the static Monaco import with a type-only import.
- Ensure runtime Monaco import remains dynamic.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P5 (Monaco must be lazy-loaded)

---

## Task 5 - Terminal env allowlist + docs
**Files**:
- `apps/electron-shell/src/main/services/TerminalService.ts`
- `apps/electron-shell/src/main/services/TerminalService.test.ts`
- `docs/architecture/architecture.md`

**Work**:
- Implement a terminal env allowlist consistent with security docs (reuse `buildChildProcessEnv`).
- Drop user-provided env keys that are not on the allowlist (no extra vars).
- Add or update tests to validate secrets are excluded.
- Update docs to describe terminal env behavior explicitly.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P3 (Secrets)

---

## Task 6 - Guardrail follow-up: split preload-api contracts
**Files**:
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/types/` (new modules)
- `packages/api-contracts/src/index.ts`

**Work**:
- Split `PreloadAPI` into smaller modules grouped by domain (workspace, terminal, output, diagnostics, agents, extensions, window/menu).
- Keep public exports stable via `index.ts`.

**Verify**:
- `pnpm --filter packages-api-contracts typecheck`

**Invariants**:
- P6 (Contracts-first)
- Guardrails: file size limits

---

## Task 7 - Guardrail follow-up: split App shell orchestration
**Files**:
- `apps/electron-shell/src/renderer/App.tsx`
- `apps/electron-shell/src/renderer/components/layout/` (new or existing modules)
- `apps/electron-shell/src/renderer/hooks/` (new or existing hooks)

**Work**:
- Split App shell orchestration into smaller components/hooks to meet guardrails.
- Separate menu event wiring, fatal banner, and command palette handling into focused modules.
- Keep public behavior unchanged.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- Guardrails: component/file size limits

---

## Task 8 - Guardrail follow-up: split MonacoEditor
**Files**:
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.tsx`
- `apps/electron-shell/src/renderer/components/editor/monaco/` (new modules)

**Work**:
- Split MonacoEditor into smaller modules (hooks/helpers/view) to meet guardrails.
- Keep editor behavior and dynamic loading unchanged.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P5 (Monaco must be lazy-loaded)
- Guardrails: component/file size limits
