
# ui-kit: Headless UI + Heroicons Migration Tasks

## Task 1 — Dependency setup + baseline build/test
**Effort**: 1–2h  
**Files**:
- `packages/ui-kit/package.json`
- `packages/ui-kit/pnpm-lock.yaml` (or repo lockfile)
- (optional) `packages/ui-kit/README.md` (dependency note)
**Work**:
- Add `@headlessui/react` and `@heroicons/react`.
- Verify build still works in monorepo.
**Verify**:
- `pnpm --filter packages-ui-kit build`
- `pnpm --filter packages-ui-kit test` (or equivalent)
**Invariants**:
- No Electron/Node APIs introduced.
- No breaking exports.
**Done =**
- ui-kit builds/tests green with new deps installed.

---

## Task 2 — ToggleSwitch migration to Headless UI Switch
**Effort**: 1–3h  
**Files**:
- `packages/ui-kit/src/components/ToggleSwitch.tsx` (or current path)
- `packages/ui-kit/src/components/__tests__/ToggleSwitch.test.tsx`
**Work**:
- Replace manual ARIA/keyboard handling with `Switch`.
- Preserve public props and styling.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- Same props, same outward behavior.
**Done =**
- Switch is keyboard-accessible and tests cover toggle + disabled.

---

## Task 3 — Add Icon abstraction + Heroicons mapping (scoped to ActivityBar needs)
**Effort**: 2–4h  
**Files**:
- `packages/ui-kit/src/components/Icon/Icon.tsx` (new)
- `packages/ui-kit/src/components/Icon/iconMap.ts` (new)
- `packages/ui-kit/src/components/Icon/index.ts` (new)
- `packages/ui-kit/src/index.ts` (export if desired)
**Work**:
- Create `Icon` component mapping app icon names to Heroicons.
- Keep it tiny: only the icons ActivityBar uses right now.
**Verify**:
- `pnpm --filter packages-ui-kit build`
**Invariants**:
- Tree-shakeable imports (no “import * as Icons” dumping the whole set).
**Done =**
- ActivityBar can render icons via `Icon name="..."`.

---

## Task 4 — PanelHeader migration to Headless UI Disclosure + chevrons
**Effort**: 1–3h  
**Files**:
- `packages/ui-kit/src/components/PanelHeader.tsx`
- `packages/ui-kit/src/components/__tests__/PanelHeader.test.tsx`
**Work**:
- Replace manual SVG + state with `Disclosure`.
- Use `ChevronUpIcon/ChevronDownIcon` (or a single icon rotated).
- Ensure no nested buttons.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- Keeps controlled/uncontrolled behavior consistent with current usage (document if it changes).
**Done =**
- Disclosure toggles via keyboard and announces expanded state correctly.

---

## Task 5 — ActivityBar migration: Headless UI vertical Tabs + Heroicons
**Effort**: 3–4h  
**Files**:
- `packages/ui-kit/src/components/ActivityBar.tsx`
- `packages/ui-kit/src/components/__tests__/ActivityBar.test.tsx`
- (optional) `packages/ui-kit/src/components/ActivityBar.module.css` or Tailwind classes
**Work**:
- Replace codicon class rendering with `Icon`.
- Use Headless UI `Tab.Group` in vertical orientation.
- Preserve existing IDs, selection callbacks, and layout.
**Verify**:
- `pnpm --filter packages-ui-kit test`
- Manual smoke: ensure side bar switching works with keyboard.
**Invariants**:
- No breaking changes to action IDs/labels used by consumers.
**Done =**
- ActivityBar works without codicon classes and supports keyboard navigation.

---

## Task 6 — TabBar migration: Headless UI Tabs (eliminate custom keyboard logic)
**Effort**: 3–4h  
**Files**:
- `packages/ui-kit/src/components/TabBar.tsx`
- `packages/ui-kit/src/components/__tests__/TabBar.test.tsx`
**Work**:
- Replace manual keydown logic (Arrow/Home/End) with `Tab.Group`.
- Ensure `activeTabId` maps to correct selectedIndex and vice versa.
- Preserve styling and focus-visible behavior.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- External API remains stable (or provide adapter + deprecation note).
**Done =**
- Custom keyboard nav code removed; tests validate Arrow/Home/End behavior.

---

## Task 7 — Select: Add Listbox variant (optional/custom dropdown)
**Effort**: 3–4h  
**Files**:
- `packages/ui-kit/src/components/Select.tsx`
- `packages/ui-kit/src/components/__tests__/Select.test.tsx`
- (optional) `packages/ui-kit/src/styles/zIndex.ts` or theme token location
**Work**:
- Implement `variant="listbox"` using Headless UI `Listbox`.
- Default remains native.
- Ensure dropdown layering (z-index), scroll, long lists.
**Verify**:
- `pnpm --filter packages-ui-kit test`
**Invariants**:
- Existing native select behavior unchanged for default consumers.
**Done =**
- Listbox select is available and passes keyboard + close-on-esc tests.

---

## Task 8 — Test suite updates + a11y pass (wrap-up hardening)
**Effort**: 3–4h  
**Files**:
- Any updated test files
- (optional) `packages/ui-kit/src/test-utils/*`
**Work**:
- Normalize role-based queries.
- Add at least one regression test per migrated component for focus/keyboard.
- Remove obsolete tests for deleted keyboard logic.
**Verify**:
- `pnpm --filter packages-ui-kit test`
- `pnpm --filter packages-ui-kit build`
**Invariants**:
- Don’t weaken assertions; replace with better accessibility assertions.
**Done =**
- Tests cover key interactions and suite is green.

---

## Task 9 — Docs + incremental rollout notes
**Effort**: 1–2h  
**Files**:
- `packages/ui-kit/README.md`
- (optional) `docs/ui-kit-migration.md`
**Work**:
- Document Select variant usage and Icon mapping strategy.
- Note codicon dependency status (what remains, what’s removed).
**Verify**:
- `pnpm --filter packages-ui-kit build`
**Done =**
- Consumers have clear guidance; no guesswork required.
