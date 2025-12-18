# 020-settings-theming

## Problem / Why

The ai-shell currently uses hardcoded Tailwind 4 colors with a dark theme. To be a production-grade IDE, we need a comprehensive settings and theming system that allows users to:
1. Switch between light, dark, and custom themes
2. Configure application preferences (editor settings, keyboard shortcuts, UI behavior)
3. Override theme colors via CSS variables without breaking the token contract
4. Persist theme and settings choices per workspace or globally

Without this, users cannot customize the app to their preferences, and the hardcoded dark theme limits accessibility and usability for users who prefer light themes or high-contrast modes.

## Goals

- Implement a theme system using Tailwind 4 CSS variables that supports light, dark, and high-contrast themes
- Create a Settings UI with categories (Appearance, Editor, Extensions, Keyboard Shortcuts) accessible via Activity Bar
- Persist theme and settings to main process storage (not localStorage) for durability and workspace isolation
- Define settings schema in `packages/api-contracts` with Zod validation
- Support `data-theme` attribute switching on root element to change themes without page reload
- Expose theme tokens to extensions via approved CSS variable API (no arbitrary CSS injection)
- Provide settings search functionality for discoverability
- Ensure all existing UI components (ShellLayout, ActivityBar, StatusBar) respect theme tokens

## Non-goals

- Full Monaco editor settings integration (Monaco configuration is separate spec)
- Custom theme authoring UI (users can edit CSS variables manually, but no visual theme editor)
- Extension-contributed settings pages (extensions can register settings, but custom UIs are future work)
- Sync settings across devices (cloud sync is future enhancement)
- Import/export settings JSON (future enhancement)
- Settings profiles or per-project overrides (future enhancement)
- Keyboard shortcut editor UI (keyboard shortcuts defined, but remapping UI is future)

## User stories

**As a user**, I want to switch between light and dark themes, so I can work comfortably in different lighting conditions.

**As a user**, I want to access settings via the Activity Bar, so I can configure the app without memorizing commands.

**As a user**, I want my theme choice to persist when I close and reopen the app, so I don't have to reconfigure it every session.

**As a user**, I want to search for settings by keyword, so I can quickly find specific options without navigating categories.

**As a user**, I want high-contrast theme support, so I can use the app with better accessibility.

**As a developer**, I want theme tokens to be CSS variables, so I can build new components that automatically respect the active theme.

**As an extension author**, I want to register custom settings, so users can configure my extension's behavior.

## UX requirements

### Theme Switcher

1. **Location**: Settings panel → Appearance section
2. **Options**: 
   - Dark (default)
   - Light
   - High Contrast Dark
   - High Contrast Light
   - System (follows OS preference)
3. **Preview**: Theme changes apply immediately (no reload required)
4. **Indicator**: Current theme highlighted in dropdown or radio group

### Settings Panel

1. **Access**: 
   - Activity Bar → Settings icon (gear icon, bottom of activity bar)
   - Command: `Ctrl+,` (Cmd+, on Mac) opens Settings
2. **Layout**:
   - Left sidebar: Category list (Appearance, Editor, Extensions, Keyboard Shortcuts)
   - Main area: Settings for selected category with search bar at top
   - Each setting: Label, description, input control (toggle, dropdown, text field)
3. **Search**:
   - Search bar at top of settings panel
   - Filters settings by label, description, or setting key
   - Shows matching settings across all categories
4. **Settings Controls**:
   - Boolean: Toggle switch
   - Enum: Dropdown select
   - String: Text input
   - Number: Number input with validation

### Theme Token Structure

All Tailwind 4 colors replaced with CSS variables:
- `--color-surface-default`: Main surface background
- `--color-surface-secondary`: Secondary surface (sidebars)
- `--color-surface-elevated`: Elevated components (modals, dropdowns)
- `--color-border-default`: Default border color
- `--color-text-primary`: Primary text color
- `--color-text-secondary`: Secondary/muted text
- `--color-accent-primary`: Accent color (buttons, highlights)
- `--color-accent-hover`: Accent hover state
- `--color-status-info`, `--color-status-success`, `--color-status-warning`, `--color-status-error`

Themes override these variables under `[data-theme="light"]`, `[data-theme="dark"]`, etc.

## Functional requirements

### Settings Schema

1. **Define in `packages/api-contracts/src/types/settings.ts`**:
   ```typescript
   const SettingsSchema = z.object({
     appearance: z.object({
       theme: z.enum(['dark', 'light', 'high-contrast-dark', 'high-contrast-light', 'system']),
       fontSize: z.number().min(10).max(24), // base font size
       iconTheme: z.enum(['default', 'minimal']),
     }),
     editor: z.object({
       wordWrap: z.boolean(),
       lineNumbers: z.boolean(),
       minimap: z.boolean(),
       // (Monaco settings are future work, just placeholders here)
     }),
     extensions: z.object({
       autoUpdate: z.boolean(),
       enableTelemetry: z.boolean(),
     }),
   });

   type Settings = z.infer<typeof SettingsSchema>;
   ```

2. **Default Settings**: Define `SETTINGS_DEFAULTS` constant exported from contracts

### IPC Contract

1. **`IPC_CHANNELS.GET_SETTINGS`**: Returns entire settings object
2. **`IPC_CHANNELS.UPDATE_SETTINGS`**: Accepts partial settings object, merges with existing, validates with Zod, persists to disk
3. **`IPC_CHANNELS.RESET_SETTINGS`**: Resets to defaults

**Storage**: Main process stores settings in:
- Windows: `%APPDATA%/ai-shell/settings.json`
- macOS: `~/Library/Application Support/ai-shell/settings.json`
- Linux: `~/.config/ai-shell/settings.json`

Use Electron `app.getPath('userData')` + `/settings.json`

**Format**: Pretty-printed JSON (2-space indent) for human readability

### Theme Switching Implementation

1. **Renderer Component** (`apps/electron-shell/src/renderer/components/ThemeProvider.tsx`):
   - Reads settings via IPC on mount
   - Sets `data-theme` attribute on `<html>` element
   - For `theme: 'system'`, queries `window.matchMedia('(prefers-color-scheme: dark)')` and auto-switches
   - Provides `useTheme()` hook for components to access current theme

2. **CSS Variables** (`apps/electron-shell/src/renderer/styles/themes.css`):
   - Define default dark theme variables at `:root`
   - Override variables for each theme under `[data-theme="light"]`, etc.
   - Example:
     ```css
     :root {
       --color-surface-default: #0a0a0a;
       --color-text-primary: #ffffff;
     }
     [data-theme="light"] {
       --color-surface-default: #ffffff;
       --color-text-primary: #000000;
     }
     ```

3. **Update ui-kit components**: Replace hardcoded Tailwind colors with `bg-[var(--color-surface-default)]` or custom Tailwind config mapping

### Settings UI Component

1. **`apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`**:
   - Left sidebar with category navigation
   - Search input at top
   - Settings list with controls (ToggleSwitch, Select, Input)
   - Calls `window.api.updateSettings()` on change

2. **Activity Bar Integration**:
   - Add Settings icon (gear) to bottom of ActivityBar
   - Clicking icon sets `activeActivityBarIcon: 'settings'`
   - Primary Sidebar displays `<SettingsPanel>` when settings active

3. **Search Functionality**:
   - Filter settings by label/description/key using fuzzy match
   - Highlight matching text in results

### Error Handling

- **Corrupted settings.json**: Fall back to defaults with warning log; never block app launch
- **Invalid settings updates**: Reject with Zod validation error; show user-friendly error message in UI
- **Disk write failures**: Retry once; if fails, log error and keep settings in memory only (warn user)

## Security requirements

- Settings stored in main process (not renderer localStorage) to prevent tampering
- Validate all settings updates with Zod schema before persisting (prevent injection)
- Theme CSS variables must be an approved allowlist (no arbitrary CSS injection)
- Extensions can register settings, but cannot read other extensions' settings without permission
- Settings file permissions: readable/writable only by app user (standard file permissions)
- No secrets in settings (API keys, tokens, passwords go through SecretsService)
- **P1 (Process Isolation)**: Settings read/write via IPC only; main process owns file access
- **P2 (Security Defaults)**: No changes to contextIsolation, sandbox, or nodeIntegration
- **P3 (Secrets)**: Never store credentials in settings.json; use safeStorage for secrets

## Performance requirements

- **Settings Load**: `GET_SETTINGS` IPC call completes within 50ms (includes disk read + validation)
- **Settings Update**: `UPDATE_SETTINGS` IPC call completes within 100ms (includes merge + disk write)
- **Theme Switch**: Changing `data-theme` attribute re-paints UI within 16ms (one frame, no flicker)
- **Settings Search**: Search filtering 100+ settings completes within 50ms (interactive)
- **Bundle Size**: Settings UI and theme system add ≤ 80KB to renderer bundle
- **Memory**: Settings state in main process ≤ 1MB; renderer cache ≤ 500KB
- **Settings Panel Render**: Initial render of settings panel completes within 100ms

## Acceptance criteria

1. ✅ Settings schema defined in `packages/api-contracts` with Zod validation
2. ✅ IPC channels for `GET_SETTINGS`, `UPDATE_SETTINGS`, `RESET_SETTINGS` implemented
3. ✅ Main process reads/writes settings to `app.getPath('userData')/settings.json`
4. ✅ Settings file created with defaults on first launch if it doesn't exist
5. ✅ Theme switcher in Settings → Appearance allows selecting Dark, Light, High Contrast Dark, High Contrast Light, System
6. ✅ Changing theme updates `data-theme` attribute on `<html>` element without reload
7. ✅ System theme option queries OS preference and auto-switches
8. ✅ CSS variables defined for all theme tokens (surface, text, border, accent, status colors)
9. ✅ All existing layout components (ShellLayout, ActivityBar, StatusBar, ResizablePanel) use CSS variables instead of hardcoded colors
10. ✅ Settings panel renders with category sidebar and main settings area
11. ✅ Settings panel accessible via Activity Bar Settings icon (gear, bottom of bar)
12. ✅ Settings panel opens with `Ctrl+,` keyboard shortcut
13. ✅ Settings search filters settings by label, description, or key
14. ✅ Boolean settings use toggle switches; enum settings use dropdowns
15. ✅ Updating a setting calls `window.api.updateSettings()` and persists to disk
16. ✅ Theme and settings choices persist across app restarts
17. ✅ Invalid settings updates rejected by Zod validation (with error message to user)
18. ✅ Corrupted settings.json falls back to defaults without blocking app launch
19. ✅ Reset Settings button restores all settings to defaults
20. ✅ TypeScript compiles with 0 errors (`pnpm -r typecheck`)
21. ✅ ESLint passes with 0 errors (`pnpm -r lint`)
22. ✅ Unit tests for settings IPC handlers (main process)
23. ✅ Unit tests for theme switching logic (renderer)
24. ✅ Playwright E2E test: change theme, verify CSS variables update, restart app, verify persistence

## Out of scope / Future work

- **Monaco Editor Settings**: Full integration with Monaco editor config (separate spec)
- **Custom Theme Editor**: Visual UI for creating custom themes (future enhancement)
- **Settings Sync**: Sync settings across devices via cloud (future spec)
- **Import/Export Settings**: Export settings.json and import on another machine (future enhancement)
- **Settings Profiles**: Multiple named settings profiles (e.g., "Work", "Home") (future enhancement)
- **Per-Workspace Settings**: Override global settings per workspace (future spec)
- **Keyboard Shortcut Remapping UI**: Visual editor for customizing keyboard shortcuts (future spec)
- **Extension-Contributed Settings Pages**: Custom settings UIs from extensions (future spec)
- **Settings API for Extensions**: Extensions can read/write their own settings namespace (future spec)
- **Theme Marketplace**: Browse and install community themes (future enhancement)

## Open questions

1. Should theme switching trigger a notification/toast to confirm the change, or is immediate visual feedback sufficient?
   - **Decision**: Immediate visual feedback sufficient; no toast needed.

2. Should we support a "System" theme option that follows OS light/dark mode preference?
   - **Decision**: Yes, add "System" as fifth theme option. Query `window.matchMedia('(prefers-color-scheme: dark)')` in renderer and auto-switch. Store as `theme: 'system'` in settings.

3. Should settings.json be pretty-printed (indented) or minified?
   - **Decision**: Pretty-printed (2-space indent) for human readability and manual editing.

4. Should invalid settings.json on disk cause app to fail launch, or fall back to defaults?
   - **Decision**: Fall back to defaults with warning log. Never block app launch due to corrupted settings.

5. Should we expose a `window.api.watchSettings()` API for renderer to receive real-time updates if another process modifies settings.json?
   - **Decision**: Not in this spec. Settings are write-through (renderer updates via IPC, no external writes). Future enhancement if multi-window support added.
