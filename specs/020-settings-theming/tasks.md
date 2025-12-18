# 020-settings-theming — Implementation Tasks

## Task 1 — Define Settings schema and IPC contracts in api-contracts
**Description**: Define Settings Zod schema with all categories, IPC channels, and PreloadAPI extensions (contracts-first approach per P6).

**Files to create/modify**:
- `packages/api-contracts/src/types/settings.ts` (create)
- `packages/api-contracts/src/ipc-channels.ts` (modify: add settings channels)
- `packages/api-contracts/src/preload-api.ts` (modify: add settings methods)
- `packages/api-contracts/src/types/layout-state.ts` (modify: add 'settings' to ActivityBarIcon enum)
- `packages/api-contracts/src/index.ts` (modify: add export)

**Implementation details**:
- Create `SettingsSchema` with nested categories:
  - `AppearanceSettingsSchema`: theme (enum: dark/light/high-contrast-dark/high-contrast-light/system), fontSize (10-24), iconTheme (enum: default/minimal)
  - `EditorSettingsSchema`: wordWrap, lineNumbers, minimap (boolean placeholders)
  - `ExtensionSettingsSchema`: autoUpdate, enableTelemetry (booleans)
- Export `Settings`, `PartialSettings`, `SETTINGS_DEFAULTS` types
- Add IPC channels: `GET_SETTINGS`, `UPDATE_SETTINGS`, `RESET_SETTINGS`
- Extend PreloadAPI with 3 methods: `getSettings()`, `updateSettings(updates)`, `resetSettings()`
- Update `activeActivityBarIcon` enum to include `'settings'`
- Add comprehensive TSDoc comments

**Verification commands**:
```powershell
pnpm --filter packages-api-contracts typecheck
pnpm --filter packages-api-contracts lint
pnpm --filter packages-api-contracts build
```

**Invariants that must remain true**:
- **P6 (Contracts-first)**: All settings types defined in api-contracts BEFORE main/renderer implementation
- **P1 (Process isolation)**: PreloadAPI is readonly contract; no implementation in contracts package
- **P2 (Security defaults)**: No secrets in SettingsSchema (P3: secrets use safeStorage, not settings.json)

---

## Task 2 — Implement SettingsService in main process
**Description**: Create singleton SettingsService class that manages settings.json persistence with error handling.

**Files to create/modify**:
- `apps/electron-shell/src/main/services/SettingsService.ts` (create)

**Implementation details**:
- Singleton class with private constructor
- Storage path: `app.getPath('userData')/settings.json`
- Methods:
  - `getSettings()`: Read from disk, parse JSON, validate with Zod, return Settings
  - `updateSettings(updates: PartialSettings)`: Deep merge with existing, validate, write to disk, return updated Settings
  - `resetSettings()`: Overwrite with SETTINGS_DEFAULTS, return defaults
- Error handling:
  - Corrupted file: Log warning, use SETTINGS_DEFAULTS, overwrite file
  - Write failure: Retry once after 100ms, throw error if retry fails
  - Never block app launch
- Pretty-print JSON with 2-space indent (`JSON.stringify(settings, null, 2)`)
- Initialize on first import with lazy file creation

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: SettingsService runs ONLY in main process; never imported in renderer
- **P3 (Secrets)**: No secrets stored in settings.json (enforce via SettingsSchema validation)
- **P2 (Security defaults)**: File path never exposed to renderer process

---

## Task 3 — Add settings IPC handlers and expose via preload
**Description**: Register IPC handlers in main process and expose settings methods via contextBridge.

**Files to create/modify**:
- `apps/electron-shell/src/main/ipc-handlers.ts` (modify: add 3 handlers)
- `apps/electron-shell/src/main/index.ts` (modify: initialize SettingsService on app start)
- `apps/electron-shell/src/preload/index.ts` (modify: add 3 methods to api object)

**Implementation details**:
- Main process IPC handlers:
  - `ipcMain.handle(IPC_CHANNELS.GET_SETTINGS)`: Return `settingsService.getSettings()`
  - `ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS)`: Validate updates with Zod partial schema, call `settingsService.updateSettings()`, return updated Settings
  - `ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS)`: Call `settingsService.resetSettings()`, return defaults
- Preload API implementation:
  - `getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS)`
  - `updateSettings: (updates) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, updates)`
  - `resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_SETTINGS)`
- Initialize SettingsService singleton in main/index.ts on app ready

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm --filter apps-electron-shell build
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Renderer accesses settings ONLY via window.api.* (no direct file access)
- **P2 (Security defaults)**: Preload uses contextBridge; no security settings changed
- **P6 (Contracts-first)**: All IPC channels use constants from api-contracts

---

## Task 4 — Define CSS variables and create themes.css
**Description**: Create themes.css with 14 CSS variables for 5 themes (dark, light, 2 high-contrast, system).

**Files to create/modify**:
- `apps/electron-shell/src/renderer/styles/themes.css` (create)
- `apps/electron-shell/src/renderer/main.tsx` (modify: import themes.css)

**Implementation details**:
- Define 14 CSS variables at `:root` (dark theme defaults):
  - `--color-surface-default`, `--color-surface-secondary`, `--color-surface-elevated`
  - `--color-border-default`
  - `--color-text-primary`, `--color-text-secondary`
  - `--color-accent-primary`, `--color-accent-hover`
  - `--color-status-info`, `--color-status-success`, `--color-status-warning`, `--color-status-error`
- Override variables for `[data-theme="light"]`, `[data-theme="high-contrast-dark"]`, `[data-theme="high-contrast-light"]`
- System theme: Use `@media (prefers-color-scheme: dark/light)` with `[data-theme="system"]` selectors
- Import themes.css in main.tsx BEFORE index.css

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm dev  # Manual check: inspect CSS variables in DevTools
```

**Invariants that must remain true**:
- **P4 (UI design system)**: All theme colors via CSS variables (Tailwind 4 token contract)
- **P1 (Process isolation)**: CSS variables are renderer-only (no main process involvement)

---

## Task 5 — Update Tailwind config to use CSS variables
**Description**: Map CSS variables to Tailwind color tokens so components can use semantic class names.

**Files to create/modify**:
- `apps/electron-shell/tailwind.config.ts` (modify: add color mappings)

**Implementation details**:
- Extend Tailwind theme with color tokens:
  - `surface: { DEFAULT: 'var(--color-surface-default)', secondary: 'var(--color-surface-secondary)', elevated: 'var(--color-surface-elevated)' }`
  - `border: { DEFAULT: 'var(--color-border-default)' }`
  - `text: { primary: 'var(--color-text-primary)', secondary: 'var(--color-text-secondary)' }`
  - `accent: { DEFAULT: 'var(--color-accent-primary)', hover: 'var(--color-accent-hover)' }`
  - `status: { info: 'var(--color-status-info)', success: 'var(--color-status-success)', warning: 'var(--color-status-warning)', error: 'var(--color-status-error)' }`
- Remove hardcoded color values; all colors now reference CSS variables
- No breaking changes: Existing hardcoded colors (e.g., `bg-gray-900`) remain available but deprecated

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm --filter apps-electron-shell build
```

**Invariants that must remain true**:
- **P4 (UI design system)**: Tailwind config is the single source of truth for color tokens
- **P1 (Process isolation)**: Tailwind config affects renderer only (no main process impact)

---

## Task 6 — Implement ThemeProvider context and hook
**Description**: Create ThemeProvider React context that fetches settings, sets data-theme attribute, and provides useTheme hook.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/ThemeProvider.tsx` (create)
- `apps/electron-shell/src/renderer/App.tsx` (modify: wrap in ThemeProvider)

**Implementation details**:
- ThemeProvider component:
  - Fetch settings via `window.api.getSettings()` on mount
  - Set `data-theme` attribute on `<html>` element in useEffect (resolves 'system' theme to 'dark' or 'light')
  - Listen to OS theme changes via `window.matchMedia('(prefers-color-scheme: dark)')` when theme is 'system'
  - Context value: `{ theme: Theme, effectiveTheme: 'dark' | 'light', setTheme: (theme: Theme) => Promise<void> }`
- `useTheme()` hook: Return context value (throws if used outside provider)
- Handle `matchMedia` failure: Fall back to 'dark' theme with console warning
- Wrap App.tsx root in `<ThemeProvider>`

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm dev  # Manual check: data-theme attribute on <html>, CSS variables applied
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: ThemeProvider uses only renderer APIs (window.api, window.matchMedia)
- **P2 (Security defaults)**: No direct IPC access; uses window.api.* only
- **P5 (Performance budgets)**: Theme switch repaints < 16ms (batch CSS changes in requestAnimationFrame if needed)

---

## Task 7 — Refactor ui-kit components to use CSS variable tokens
**Description**: Replace hardcoded Tailwind classes (bg-gray-900) with CSS variable classes (bg-surface-default) in all ui-kit components.

**Files to create/modify**:
- `packages/ui-kit/src/components/ShellLayout/ShellLayout.tsx` (modify: update class names)
- `packages/ui-kit/src/components/ActivityBar/ActivityBar.tsx` (modify: update class names)
- `packages/ui-kit/src/components/StatusBar/StatusBar.tsx` (modify: update class names)
- `packages/ui-kit/src/components/ResizablePanel/ResizablePanel.tsx` (modify: update class names)
- `packages/ui-kit/src/components/PanelHeader/PanelHeader.tsx` (modify: update class names)

**Implementation details**:
- Replace hardcoded classes:
  - `bg-gray-900` → `bg-surface-default`
  - `bg-gray-800` → `bg-surface-secondary`
  - `bg-gray-950` → `bg-surface-default` (editor area)
  - `text-white` → `text-primary`
  - `text-gray-300`, `text-gray-400` → `text-secondary`
  - `border-gray-700` → `border-border`
  - `bg-blue-900` (StatusBar) → `bg-surface-elevated`
  - `bg-blue-600` (active states) → `bg-accent`
- No prop changes; components remain backwards compatible
- Visual regression: Dark theme should look identical after refactor

**Verification commands**:
```powershell
pnpm --filter packages-ui-kit typecheck
pnpm --filter packages-ui-kit lint
pnpm --filter packages-ui-kit test  # Existing tests should still pass
pnpm --filter packages-ui-kit build
pnpm dev  # Manual check: UI looks identical to before
```

**Invariants that must remain true**:
- **P4 (UI design system)**: All colors use CSS variables (no hardcoded hex/rgb values)
- **P1 (Process isolation)**: ui-kit remains Electron-agnostic (pure React)

---

## Task 8 — Implement ui-kit form controls (ToggleSwitch, Select, Input)
**Description**: Create reusable form control components for settings UI.

**Files to create/modify**:
- `packages/ui-kit/src/components/ToggleSwitch/ToggleSwitch.tsx` (create)
- `packages/ui-kit/src/components/Select/Select.tsx` (create)
- `packages/ui-kit/src/components/Input/Input.tsx` (create)
- `packages/ui-kit/src/index.ts` (modify: add exports)

**Implementation details**:
- **ToggleSwitch**:
  - Props: `checked: boolean`, `onChange: (checked: boolean) => void`, `label?: string`, `disabled?: boolean`
  - Accessible: ARIA roles (`role="switch"`, `aria-checked`), keyboard support (Space/Enter)
  - Styled with CSS variables: `bg-accent` when checked, `bg-surface-secondary` when unchecked
- **Select**:
  - Props: `value: string`, `onChange: (value: string) => void`, `options: { value: string, label: string }[]`, `disabled?: boolean`
  - Native `<select>` element with custom styling
  - Keyboard navigation support
- **Input**:
  - Props: `type: 'text' | 'number'`, `value: string | number`, `onChange: (value: string | number) => void`, `min?: number`, `max?: number`, `disabled?: boolean`
  - Validation states (error border if value out of range for number inputs)
  - Styled with CSS variables: `border-border`, `bg-surface-default`, `text-primary`

**Verification commands**:
```powershell
pnpm --filter packages-ui-kit typecheck
pnpm --filter packages-ui-kit lint
pnpm --filter packages-ui-kit build
```

**Invariants that must remain true**:
- **P4 (UI design system)**: All components use CSS variable tokens
- **P1 (Process isolation)**: Components use only browser APIs (no Electron dependencies)

---

## Task 9 — Implement SettingsPanel UI with category navigation
**Description**: Create SettingsPanel main component with sidebar navigation, search, and setting items.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx` (create)
- `apps/electron-shell/src/renderer/components/settings/SettingsCategoryNav.tsx` (create)
- `apps/electron-shell/src/renderer/components/settings/SettingItem.tsx` (create)
- `apps/electron-shell/src/renderer/components/settings/SearchBar.tsx` (create)

**Implementation details**:
- **SettingsPanel**:
  - Fetch settings via `window.api.getSettings()` on mount
  - Two-column layout: left sidebar (categories), right content (settings + search)
  - State: `settings`, `activeCategory`, `searchQuery`
  - Debounced `window.api.updateSettings()` (300ms) on setting change
  - Categories: Appearance, Editor, Extensions
- **SettingsCategoryNav**:
  - Renders category list with active state highlighting
  - Click handler updates `activeCategory`, clears search
- **SettingItem**:
  - Props: `label`, `description`, `value`, `type` (boolean/enum/string/number), `options?`, `onChange`
  - Renders appropriate control: ToggleSwitch for boolean, Select for enum, Input for string/number
  - Description in muted text below label
- **SearchBar**:
  - Input with onChange that filters settings by label/description/key (case-insensitive substring match)
  - Shows matching settings across all categories when active

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm dev  # Manual check: Settings panel renders, categories switch, search filters
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: SettingsPanel uses only window.api.* (no direct IPC)
- **P6 (Contracts-first)**: All settings updates validated by Zod in main process before persist
- **P5 (Performance budgets)**: Settings search < 50ms for 100+ settings (use memoization if needed)

---

## Task 10 — Integrate SettingsPanel with Activity Bar and keyboard shortcuts
**Description**: Add settings icon to Activity Bar, wire up click handler, and implement Ctrl+, shortcut.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx` (modify: conditional rendering)
- `apps/electron-shell/src/renderer/App.tsx` (modify: add settings icon, conditionally render SettingsPanel, add keyboard shortcut)
- `apps/electron-shell/src/renderer/contexts/LayoutContext.tsx` (modify: add Ctrl+, shortcut handler)

**Implementation details**:
- Add settings icon to Activity Bar icons array: `{ id: 'settings', icon: '⚙️' }`
- Update App.tsx to conditionally render `<SettingsPanel>` in primary sidebar when `activeActivityBarIcon === 'settings'`
- Add keyboard shortcut handler in LayoutProvider:
  - `Ctrl+,` (Cmd+, on Mac): Set `activeActivityBarIcon` to 'settings'
  - Add cleanup on unmount
- Update LayoutContext actions to include `setActiveIcon('settings')`

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm dev  # Manual check: Click settings icon, Ctrl+, opens settings
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Keyboard shortcuts handled in renderer only (no global OS shortcuts)
- **P6 (Contracts-first)**: ActivityBarIcon enum includes 'settings' (added in Task 1)

---

## Task 11 — Add unit tests for SettingsService (main process)
**Description**: Write unit tests for SettingsService class with mocked file system.

**Files to create/modify**:
- `apps/electron-shell/src/main/services/SettingsService.test.ts` (create)

**Implementation details**:
- Test cases:
  1. `getSettings()`: Reads file, parses JSON, validates with Zod
  2. `getSettings()` with corrupted file: Falls back to SETTINGS_DEFAULTS, overwrites file
  3. `updateSettings()`: Merges partial updates, validates, persists, returns updated Settings
  4. `updateSettings()` with invalid data: Rejects with Zod error
  5. `resetSettings()`: Overwrites with SETTINGS_DEFAULTS
  6. Disk write failure: Retries once, throws on second failure
- Mock `fs.promises` and `app.getPath('userData')` using Vitest mocks
- Target: 90%+ coverage of SettingsService

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell test
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P3 (Secrets)**: Tests verify no secrets in settings.json (SettingsSchema validation)
- **P6 (Contracts-first)**: Tests validate Zod schema constraints (min/max fontSize, valid theme enums)

---

## Task 12 — Add unit tests for ThemeProvider and SettingsPanel (renderer)
**Description**: Write unit tests for ThemeProvider context and SettingsPanel component.

**Files to create/modify**:
- `apps/electron-shell/src/renderer/components/ThemeProvider.test.tsx` (create)
- `apps/electron-shell/src/renderer/components/settings/SettingsPanel.test.tsx` (create)

**Implementation details**:
- **ThemeProvider tests**:
  1. Fetches settings on mount, sets `data-theme` attribute
  2. Theme switching: Calls `updateSettings`, updates `data-theme`
  3. System theme: Queries `matchMedia`, switches on OS change event
  4. System theme fallback: Uses 'dark' if `matchMedia` fails
- **SettingsPanel tests**:
  1. Fetches settings on mount, renders categories
  2. Setting update: Changes value, calls `updateSettings` (debounced)
  3. Search: Filters settings by query, shows matching results
  4. Category navigation: Switches categories, shows relevant settings
  5. Reset button: Calls `resetSettings`, confirms settings restored
- Mock `window.api.getSettings()`, `window.api.updateSettings()`, `window.matchMedia()`
- Target: 85%+ coverage

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell test
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: Tests verify renderer uses ONLY window.api.* (no direct IPC mocks)
- **P2 (Security defaults)**: Tests verify no secrets in settings UI or localStorage

---

## Task 13 — Add E2E tests for theme switching and persistence
**Description**: Write Playwright E2E tests for theme switching, settings persistence, and error scenarios.

**Files to create/modify**:
- `test/e2e/settings-theming.spec.ts` (create)

**Implementation details**:
- Test cases:
  1. App launches with dark theme (default)
  2. Switch to light theme: Verify `data-theme="light"`, CSS variables change (`--color-surface-default` = `#ffffff`)
  3. Persistence: Switch theme, restart app, verify theme persists
  4. System theme: Select System, verify follows OS preference (query `matchMedia` in test)
  5. Settings search: Type query, verify filtered results shown
  6. Reset settings: Click Reset button, verify all settings restored to defaults
  7. Corrupted file: Delete settings.json, replace with invalid JSON `{invalid}`, restart app, verify falls back to defaults without crash
  8. Settings icon: Click Activity Bar settings icon, verify SettingsPanel opens
  9. Keyboard shortcut: Press Ctrl+, verify SettingsPanel opens
- Use Playwright selectors: `[data-testid="settings-icon"]`, `[data-testid="theme-select"]`
- Add test IDs to components in Task 9/10 if not already present

**Verification commands**:
```powershell
pnpm --filter apps-electron-shell build  # Build app first
pnpm test:e2e  # Run E2E tests
```

**Invariants that must remain true**:
- **P1 (Process isolation)**: E2E tests verify renderer cannot access file system directly
- **P3 (Secrets)**: E2E tests verify no secrets stored in settings.json (inspect file in test)
- **P5 (Performance budgets)**: Theme switch repaint < 16ms (measure with Playwright performance API)

---

## Task 14 — Update documentation for settings and theming
**Description**: Update README, CONTRIBUTING, and docs/architecture with settings architecture and theme usage.

**Files to create/modify**:
- `README.md` (modify: add "Theme Switching" section)
- `docs/architecture.md` (modify: add "Settings System" section)
- `CONTRIBUTING.md` (modify: add "CSS Variables and Theming" section)

**Implementation details**:
- **README.md**:
  - Add "Theme Switching" section with 5 theme options (Dark, Light, High Contrast Dark/Light, System)
  - Keyboard shortcut: Ctrl+, to open settings
  - Screenshot or ASCII diagram showing settings panel
- **docs/architecture.md**:
  - Add "Settings System" section after "Layout System"
  - Describe SettingsService (main process), settings.json storage
  - IPC contract (GET_SETTINGS, UPDATE_SETTINGS, RESET_SETTINGS)
  - ThemeProvider architecture (data-theme attribute, CSS variables)
  - Settings schema with Zod validation
- **CONTRIBUTING.md**:
  - Add "CSS Variables and Theming" section
  - List all 14 CSS variables with descriptions
  - Guidelines: Always use `bg-surface-default` instead of `bg-gray-900`
  - How to add new theme: Override CSS variables under `[data-theme="new-theme"]`
  - Warning: Never hardcode colors; always use CSS variable tokens

**Verification commands**:
```powershell
# No automated verification for docs (manual review)
pnpm dev  # Verify links work, documentation is accurate
```

**Invariants that must remain true**:
- **P7 (Spec-Driven Development)**: Documentation reflects spec.md and plan.md accurately
- **P1 (Process isolation)**: Docs emphasize renderer-only theme system (no main process involvement except settings storage)
- **P6 (Contracts-first)**: Docs reference SettingsSchema from api-contracts

---

## Verification after all tasks complete

Run full verification suite:
```powershell
# 1. Type checking
pnpm -r typecheck

# 2. Linting
pnpm -r lint

# 3. Unit tests
pnpm --filter apps-electron-shell test
pnpm --filter packages-ui-kit test

# 4. Build all packages
pnpm -r build

# 5. E2E tests (requires packaged app)
pnpm test:e2e

# 6. Manual smoke test
pnpm dev
# - Switch between all 5 themes, verify visual changes
# - Search settings, verify filtering works
# - Restart app, verify theme persists
# - Corrupt settings.json, restart, verify fallback to defaults
```

**Final acceptance criteria checklist**:
- [ ] 24 acceptance criteria from spec.md all pass
- [ ] TypeScript compiles with 0 errors
- [ ] ESLint passes with 0 errors
- [ ] All unit tests pass (SettingsService, ThemeProvider, SettingsPanel, ui-kit form controls)
- [ ] All E2E tests pass (theme switching, persistence, error scenarios)
- [ ] Documentation updated (README, CONTRIBUTING, architecture)
- [ ] Manual QA: All 5 themes work, settings persist, corrupted file handled gracefully
