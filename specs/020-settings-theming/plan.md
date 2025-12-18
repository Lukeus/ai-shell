# 020-settings-theming — Technical Plan

## Architecture changes

### New settings service in main process
**File**: `apps/electron-shell/src/main/services/SettingsService.ts`
- **Purpose**: Owns settings persistence, validation, and CRUD operations
- **Storage**: `app.getPath('userData')/settings.json` (Windows: `%APPDATA%/ai-shell/settings.json`)
- **Format**: Pretty-printed JSON (2-space indent) for manual editing
- **Lifecycle**: Singleton instance initialized in main process on app start
- **Error handling**: Corrupted file falls back to defaults with warning log, never blocks app launch

### New IPC handlers in main process
**File**: `apps/electron-shell/src/main/ipc-handlers.ts`
- Add 3 new handlers: `GET_SETTINGS`, `UPDATE_SETTINGS`, `RESET_SETTINGS`
- Each handler delegates to `SettingsService` instance
- `UPDATE_SETTINGS` performs deep merge (not full replace) and Zod validation before persist

### Theme system in renderer
**File**: `apps/electron-shell/src/renderer/components/ThemeProvider.tsx`
- **Purpose**: React context provider that manages theme state and CSS variable application
- **Initialization**: Fetches settings via IPC on mount, sets `data-theme` attribute on `<html>`
- **System theme**: Queries `window.matchMedia('(prefers-color-scheme: dark)')` and listens for OS changes
- **Exports**: `useTheme()` hook for components to access current theme name

### CSS variable architecture
**File**: `apps/electron-shell/src/renderer/styles/themes.css`
- Define 14 CSS variables at `:root` (dark theme defaults)
- Override variables for 4 additional themes: `[data-theme="light"]`, `[data-theme="high-contrast-dark"]`, `[data-theme="high-contrast-light"]`
- System theme uses conditional CSS: `@media (prefers-color-scheme: light) { [data-theme="system"] { ... } }`

### Tailwind 4 integration changes
**File**: `apps/electron-shell/tailwind.config.ts`
- Map CSS variables to Tailwind tokens: `colors: { surface: { DEFAULT: 'var(--color-surface-default)' } }`
- Remove hardcoded color values; all colors reference CSS variables
- Ensures theme switching works without Tailwind rebuild

### Settings UI components
**Directory**: `apps/electron-shell/src/renderer/components/settings/`
- `SettingsPanel.tsx`: Main container with sidebar + content area
- `SettingsCategoryNav.tsx`: Left sidebar with category list
- `SettingItem.tsx`: Individual setting row with label, description, control
- `ToggleSwitch.tsx`, `Select.tsx`, `Input.tsx`: Reusable form controls (add to ui-kit)
- `SearchBar.tsx`: Filters settings by text match

### Activity Bar update
**File**: `apps/electron-shell/src/renderer/components/layout/ActivityBarWrapper.tsx`
- Add 7th icon: Settings (gear icon) at bottom of activity bar
- Update `ActivityBarIcon` enum in `layout-state.ts` to include `'settings'`
- When settings icon clicked, render `<SettingsPanel>` in primary sidebar

### No changes to ui-kit layout components structure
Existing `ShellLayout`, `ResizablePanel`, `ActivityBar`, `StatusBar` components remain unchanged in structure but:
- **Styling update**: Replace hardcoded Tailwind classes (`bg-gray-900`) with CSS variable classes (`bg-surface-default`)
- **Backwards compatible**: Components use same props, only internal class names change

## Contracts (api-contracts updates)

### 1. Settings Schema
**File**: `packages/api-contracts/src/types/settings.ts`

```typescript
import { z } from 'zod';

/**
 * Theme options for the application.
 * - dark: Default dark theme
 * - light: Light theme for daytime use
 * - high-contrast-dark: High contrast dark for accessibility
 * - high-contrast-light: High contrast light for accessibility
 * - system: Follows OS light/dark mode preference
 */
export const ThemeSchema = z.enum(['dark', 'light', 'high-contrast-dark', 'high-contrast-light', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Icon theme options.
 */
export const IconThemeSchema = z.enum(['default', 'minimal']);
export type IconTheme = z.infer<typeof IconThemeSchema>;

/**
 * Appearance settings (theme, font size, icon theme).
 */
export const AppearanceSettingsSchema = z.object({
  theme: ThemeSchema.default('dark'),
  fontSize: z.number().int().min(10).max(24).default(14),
  iconTheme: IconThemeSchema.default('default'),
});
export type AppearanceSettings = z.infer<typeof AppearanceSettingsSchema>;

/**
 * Editor settings (placeholders for future Monaco integration).
 */
export const EditorSettingsSchema = z.object({
  wordWrap: z.boolean().default(false),
  lineNumbers: z.boolean().default(true),
  minimap: z.boolean().default(true),
});
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

/**
 * Extension settings.
 */
export const ExtensionSettingsSchema = z.object({
  autoUpdate: z.boolean().default(true),
  enableTelemetry: z.boolean().default(false),
});
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

/**
 * Root settings schema.
 * Top-level settings object with nested categories.
 */
export const SettingsSchema = z.object({
  appearance: AppearanceSettingsSchema,
  editor: EditorSettingsSchema,
  extensions: ExtensionSettingsSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Default settings. Used on first launch or when resetting.
 */
export const SETTINGS_DEFAULTS: Settings = SettingsSchema.parse({
  appearance: {},
  editor: {},
  extensions: {},
});

/**
 * Partial settings schema for updates.
 * Allows updating subset of settings without full object.
 */
export type PartialSettings = z.infer<typeof SettingsSchema.partial().deepPartial()>;
```

**Export**: Add `export * from './types/settings';` to `packages/api-contracts/src/index.ts`

### 2. IPC Channels
**File**: `packages/api-contracts/src/ipc-channels.ts`

```typescript
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
  // Settings management
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  RESET_SETTINGS: 'settings:reset',
} as const;
```

### 3. PreloadAPI Extension
**File**: `packages/api-contracts/src/preload-api.ts`

```typescript
import type { AppInfo } from './types/app-info';
import type { Settings, PartialSettings } from './types/settings';

export interface PreloadAPI {
  getVersion(): Promise<AppInfo>;
  
  /**
   * Retrieves all application settings.
   * @returns Promise resolving to Settings object
   */
  getSettings(): Promise<Settings>;
  
  /**
   * Updates application settings (partial merge).
   * Validates with Zod schema before persisting to disk.
   * @param updates - Partial settings object with updates
   * @returns Promise resolving to updated Settings object
   * @throws Error if validation fails
   */
  updateSettings(updates: PartialSettings): Promise<Settings>;
  
  /**
   * Resets all settings to defaults.
   * @returns Promise resolving to default Settings object
   */
  resetSettings(): Promise<Settings>;
}
```

### 4. Update ActivityBarIcon enum
**File**: `packages/api-contracts/src/types/layout-state.ts`

```typescript
// Change activeActivityBarIcon enum to include 'settings':
activeActivityBarIcon: z.enum([
  'explorer', 
  'search', 
  'source-control', 
  'run-debug', 
  'extensions', 
  'settings'  // NEW
]).default('explorer'),
```

## IPC + process boundaries

### Main process IPC handlers
**File**: `apps/electron-shell/src/main/ipc-handlers.ts`

```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS, SettingsSchema } from 'packages-api-contracts';
import { settingsService } from './services/SettingsService';

export function registerIPCHandlers() {
  // Existing handler
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async () => { /* ... */ });
  
  // NEW: Settings handlers
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return settingsService.getSettings();
  });
  
  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, updates) => {
    // Validate partial updates with Zod
    const validatedUpdates = SettingsSchema.partial().deepPartial().parse(updates);
    return settingsService.updateSettings(validatedUpdates);
  });
  
  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async () => {
    return settingsService.resetSettings();
  });
}
```

### Preload bridge
**File**: `apps/electron-shell/src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, PreloadAPI } from 'packages-api-contracts';

const api: PreloadAPI = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION),
  // NEW: Settings methods
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSettings: (updates) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, updates),
  resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_SETTINGS),
};

contextBridge.exposeInMainWorld('api', api);
```

### Process isolation compliance (P1)
- **Main process**: Owns all file system access (settings.json read/write)
- **Renderer process**: No direct file access; calls `window.api.*` for settings
- **Preload script**: Type-safe bridge with Zod validation in main process
- **Security boundary**: Settings file path (`app.getPath('userData')`) never exposed to renderer
- **Validation**: All settings updates validated with Zod in main process before disk write

### Data flow diagram
```
┌─────────────────────────────────────────────┐
│  Renderer (Sandboxed)                       │
│  ┌──────────────────────────────────────┐   │
│  │ ThemeProvider                        │   │
│  │ - Calls window.api.getSettings()     │   │
│  │ - Sets data-theme attribute          │   │
│  └──────────────┬───────────────────────┘   │
│                 │                            │
│  ┌──────────────▼───────────────────────┐   │
│  │ SettingsPanel                        │   │
│  │ - User changes theme                 │   │
│  │ - Calls window.api.updateSettings()  │   │
│  └──────────────┬───────────────────────┘   │
└─────────────────┼───────────────────────────┘
                  │ window.api.* (IPC invoke)
┌─────────────────▼───────────────────────────┐
│  Preload (contextBridge)                    │
│  - Wraps ipcRenderer.invoke()               │
└─────────────────┬───────────────────────────┘
                  │ ipcRenderer.invoke()
┌─────────────────▼───────────────────────────┐
│  Main Process                               │
│  ┌──────────────────────────────────────┐   │
│  │ IPC Handler: UPDATE_SETTINGS         │   │
│  │ 1. Validate with Zod                 │   │
│  │ 2. Delegate to SettingsService       │   │
│  └──────────────┬───────────────────────┘   │
│                 │                            │
│  ┌──────────────▼───────────────────────┐   │
│  │ SettingsService                      │   │
│  │ - Deep merge updates                 │   │
│  │ - Write to settings.json             │   │
│  │ - Error handling (retry on failure)  │   │
│  └──────────────┬───────────────────────┘   │
│                 │                            │
│                 ▼                            │
│     ┌────────────────────────┐              │
│     │  settings.json         │              │
│     │  (userData directory)  │              │
│     └────────────────────────┘              │
└─────────────────────────────────────────────┘
```

## UI components and routes

### ThemeProvider (context)
**File**: `apps/electron-shell/src/renderer/components/ThemeProvider.tsx`

```typescript
interface ThemeContextValue {
  theme: Theme;
  effectiveTheme: 'dark' | 'light'; // Resolved theme (system -> dark/light)
  setTheme: (theme: Theme) => Promise<void>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  
  useEffect(() => {
    // Load settings on mount
    window.api.getSettings().then(setSettings);
    
    // Listen for OS theme changes if theme === 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => { /* re-compute effectiveTheme */ };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  useEffect(() => {
    // Apply theme to <html> element
    if (settings) {
      const effectiveTheme = resolveTheme(settings.appearance.theme);
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    }
  }, [settings?.appearance.theme]);
  
  const setTheme = async (theme: Theme) => {
    const updated = await window.api.updateSettings({ appearance: { theme } });
    setSettings(updated);
  };
  
  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

### SettingsPanel (main UI)
**File**: `apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx`

**Layout**: Two-column grid
- **Left sidebar**: Category list (Appearance, Editor, Extensions, Keyboard Shortcuts)
- **Right content**: Search bar + settings list

**State management**:
- Fetches settings via `window.api.getSettings()` on mount
- Local state for search query and active category
- Debounced `window.api.updateSettings()` on setting change (300ms delay)

**Search logic**:
- Filters settings by label, description, or key (case-insensitive substring match)
- Shows all matching settings across categories when search active
- Clears search on category click

### SettingItem (individual setting)
**File**: `apps/electron-shell/src/renderer/components/settings/SettingItem.tsx`

**Props**:
```typescript
interface SettingItemProps {
  label: string;
  description: string;
  value: string | number | boolean;
  type: 'boolean' | 'enum' | 'string' | 'number';
  options?: string[]; // For enum type
  onChange: (value: unknown) => void;
}
```

**Renders**:
- Boolean: `<ToggleSwitch>` (ui-kit component)
- Enum: `<Select>` (ui-kit component) with dropdown
- String: `<Input type="text">` (ui-kit component)
- Number: `<Input type="number">` (ui-kit component) with min/max validation

### ui-kit form controls
**Directory**: `packages/ui-kit/src/components/`
- `ToggleSwitch.tsx`: Accessible toggle switch (ARIA roles, keyboard navigation)
- `Select.tsx`: Styled dropdown with keyboard support
- `Input.tsx`: Text/number input with validation states

### Activity Bar integration
**File**: `apps/electron-shell/src/renderer/components/layout/ActivityBarWrapper.tsx`

Add settings icon rendering:
```typescript
const icons = [
  { id: 'explorer', icon: '📁' },
  { id: 'search', icon: '🔍' },
  { id: 'source-control', icon: '🔀' },
  { id: 'run-debug', icon: '▶️' },
  { id: 'extensions', icon: '🧩' },
  { id: 'settings', icon: '⚙️' }, // NEW
];
```

When `activeActivityBarIcon === 'settings'`, render `<SettingsPanel>` in primary sidebar.

## Data model changes

### Settings file structure
**Location**: `app.getPath('userData')/settings.json`

```json
{
  "appearance": {
    "theme": "dark",
    "fontSize": 14,
    "iconTheme": "default"
  },
  "editor": {
    "wordWrap": false,
    "lineNumbers": true,
    "minimap": true
  },
  "extensions": {
    "autoUpdate": true,
    "enableTelemetry": false
  }
}
```

### CSS variable defaults
**File**: `apps/electron-shell/src/renderer/styles/themes.css`

```css
:root {
  /* Dark theme (default) */
  --color-surface-default: #0a0a0a;
  --color-surface-secondary: #1a1a1a;
  --color-surface-elevated: #2a2a2a;
  --color-border-default: #3a3a3a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #a0a0a0;
  --color-accent-primary: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-status-info: #3b82f6;
  --color-status-success: #10b981;
  --color-status-warning: #f59e0b;
  --color-status-error: #ef4444;
}

[data-theme="light"] {
  --color-surface-default: #ffffff;
  --color-surface-secondary: #f5f5f5;
  --color-surface-elevated: #e5e5e5;
  --color-border-default: #d4d4d4;
  --color-text-primary: #000000;
  --color-text-secondary: #737373;
  --color-accent-primary: #3b82f6;
  --color-accent-hover: #2563eb;
  /* status colors unchanged */
}

[data-theme="high-contrast-dark"] {
  --color-surface-default: #000000;
  --color-surface-secondary: #000000;
  --color-surface-elevated: #1a1a1a;
  --color-border-default: #ffffff;
  --color-text-primary: #ffffff;
  --color-text-secondary: #ffffff;
  --color-accent-primary: #00ffff;
  --color-accent-hover: #00e5e5;
  /* high contrast status colors */
}

[data-theme="high-contrast-light"] {
  --color-surface-default: #ffffff;
  --color-surface-secondary: #ffffff;
  --color-surface-elevated: #f0f0f0;
  --color-border-default: #000000;
  --color-text-primary: #000000;
  --color-text-secondary: #000000;
  --color-accent-primary: #0000ff;
  --color-accent-hover: #0000cc;
  /* high contrast status colors */
}

/* System theme uses media query */
@media (prefers-color-scheme: dark) {
  [data-theme="system"] {
    /* same as dark theme */
  }
}

@media (prefers-color-scheme: light) {
  [data-theme="system"] {
    /* same as light theme */
  }
}
```

### Tailwind config mapping
**File**: `apps/electron-shell/tailwind.config.ts`

```typescript
export default {
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface-default)',
          secondary: 'var(--color-surface-secondary)',
          elevated: 'var(--color-surface-elevated)',
        },
        border: {
          DEFAULT: 'var(--color-border-default)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--color-accent-primary)',
          hover: 'var(--color-accent-hover)',
        },
        status: {
          info: 'var(--color-status-info)',
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          error: 'var(--color-status-error)',
        },
      },
    },
  },
};
```

### Refactor existing components to use CSS variables
**Files to update**:
- `packages/ui-kit/src/components/ShellLayout/ShellLayout.tsx`
- `packages/ui-kit/src/components/ActivityBar/ActivityBar.tsx`
- `packages/ui-kit/src/components/StatusBar/StatusBar.tsx`
- `packages/ui-kit/src/components/ResizablePanel/ResizablePanel.tsx`

**Changes**: Replace hardcoded Tailwind classes:
- `bg-gray-900` → `bg-surface-default`
- `bg-gray-800` → `bg-surface-secondary`
- `text-white` → `text-primary`
- `text-gray-400` → `text-secondary`
- `border-gray-700` → `border-border`

## Failure modes + recovery

### 1. Corrupted settings.json on disk
**Symptom**: JSON parse error or Zod validation failure when loading settings
**Recovery**:
- Log warning: `"Settings file corrupted, falling back to defaults"`
- Use `SETTINGS_DEFAULTS` in memory
- Attempt to write defaults to disk (overwrite corrupted file)
- If write fails, continue with in-memory defaults only
- **Never block app launch**

**Implementation** (`SettingsService.ts`):
```typescript
private loadSettings(): Settings {
  try {
    const json = fs.readFileSync(this.settingsPath, 'utf-8');
    const parsed = JSON.parse(json);
    return SettingsSchema.parse(parsed); // Zod validation
  } catch (error) {
    console.warn('Settings file corrupted, using defaults:', error);
    this.saveSettings(SETTINGS_DEFAULTS); // Overwrite with defaults
    return SETTINGS_DEFAULTS;
  }
}
```

### 2. Disk write failure on settings update
**Symptom**: File system error (disk full, permissions issue)
**Recovery**:
- Retry write once after 100ms delay
- If retry fails, log error and keep settings in memory only
- Show warning toast in UI: "Settings saved to memory only (disk write failed)"
- Settings persist until app restart (then lost)

**Implementation**:
```typescript
private async saveSettings(settings: Settings): Promise<void> {
  const json = JSON.stringify(settings, null, 2);
  try {
    await fs.promises.writeFile(this.settingsPath, json, 'utf-8');
  } catch (error) {
    console.error('Settings write failed, retrying...', error);
    await new Promise(r => setTimeout(r, 100));
    try {
      await fs.promises.writeFile(this.settingsPath, json, 'utf-8');
    } catch (retryError) {
      console.error('Settings write retry failed:', retryError);
      throw new Error('Failed to persist settings to disk');
    }
  }
}
```

### 3. Invalid settings update from renderer
**Symptom**: Zod validation fails in IPC handler (e.g., `fontSize: 999`)
**Recovery**:
- Reject update with descriptive error message
- Return validation error to renderer
- Display error toast in UI with specific field + reason
- Keep existing settings unchanged

**Implementation**:
```typescript
ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, updates) => {
  try {
    const validated = SettingsSchema.partial().deepPartial().parse(updates);
    return settingsService.updateSettings(validated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid settings: ${error.errors[0].message}`);
    }
    throw error;
  }
});
```

### 4. Theme CSS variables not defined
**Symptom**: Components render with missing colors (inherit or transparent)
**Recovery**:
- Always define all CSS variables at `:root` (default dark theme)
- Theme overrides only change values, never remove variables
- Fallback to `:root` values if theme-specific value missing
- **Prevention**: Lint CSS to ensure all themes define all variables

### 5. OS theme query fails (system theme)
**Symptom**: `window.matchMedia` returns null or throws error (rare)
**Recovery**:
- Fall back to `dark` theme if `matchMedia` unavailable
- Log warning: "System theme unavailable, using dark theme"
- Disable "System" option in theme switcher UI

**Implementation**:
```typescript
function resolveSystemTheme(): 'dark' | 'light' {
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    return mediaQuery.matches ? 'dark' : 'light';
  } catch (error) {
    console.warn('System theme detection failed:', error);
    return 'dark';
  }
}
```

## Testing strategy

### Unit tests: Main process (SettingsService)
**File**: `apps/electron-shell/src/main/services/SettingsService.test.ts`

**Test cases**:
1. **Load settings**: Reads settings.json and validates with Zod
2. **Load corrupted file**: Falls back to defaults, overwrites file
3. **Update settings**: Merges partial updates, validates, persists
4. **Update with invalid data**: Rejects with Zod error
5. **Reset settings**: Restores SETTINGS_DEFAULTS
6. **Write failure**: Retries once, throws on second failure

**Mocking**: Mock `fs` module and `app.getPath('userData')`

### Unit tests: Renderer (ThemeProvider)
**File**: `apps/electron-shell/src/renderer/components/ThemeProvider.test.tsx`

**Test cases**:
1. **Theme initialization**: Fetches settings on mount, sets `data-theme`
2. **Theme switching**: Calls `updateSettings`, updates `data-theme`
3. **System theme**: Queries `matchMedia`, switches on OS change
4. **System theme fallback**: Uses dark if `matchMedia` fails

**Mocking**: Mock `window.api.getSettings()` and `window.matchMedia()`

### Unit tests: SettingsPanel
**File**: `apps/electron-shell/src/renderer/components/settings/SettingsPanel.test.tsx`

**Test cases**:
1. **Settings load**: Fetches settings on mount, renders categories
2. **Setting update**: Changes value, calls `updateSettings` (debounced)
3. **Search**: Filters settings by query, shows matching results
4. **Category navigation**: Switches categories, shows relevant settings
5. **Reset button**: Calls `resetSettings`, shows confirmation dialog

### Integration tests: IPC handlers
**File**: `apps/electron-shell/src/main/ipc-handlers.test.ts`

**Test cases**:
1. **GET_SETTINGS**: Returns Settings object from SettingsService
2. **UPDATE_SETTINGS**: Validates, merges, returns updated Settings
3. **UPDATE_SETTINGS invalid**: Rejects with Zod error
4. **RESET_SETTINGS**: Returns SETTINGS_DEFAULTS

**Setup**: Inject mock SettingsService instance

### E2E tests: Theme switching
**File**: `test/e2e/settings-theming.spec.ts`

**Test cases**:
1. **Initial load**: App launches with dark theme (default)
2. **Switch to light**: Click Settings → Appearance → Light, verify `data-theme="light"`, verify CSS variables change
3. **Persistence**: Switch theme, restart app, verify theme persists
4. **System theme**: Select System, verify follows OS preference
5. **Settings search**: Type query, verify filtered results
6. **Reset settings**: Click Reset, verify all settings restored to defaults
7. **Corrupted file**: Delete settings.json, replace with invalid JSON, restart app, verify falls back to defaults

**Verification**:
```typescript
test('theme switching updates CSS variables', async ({ page }) => {
  // Open settings
  await page.click('[data-testid="settings-icon"]');
  
  // Switch to light theme
  await page.selectOption('[data-testid="theme-select"]', 'light');
  
  // Verify data-theme attribute
  const theme = await page.getAttribute('html', 'data-theme');
  expect(theme).toBe('light');
  
  // Verify CSS variable changed
  const bgColor = await page.evaluate(() => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--color-surface-default');
  });
  expect(bgColor.trim()).toBe('#ffffff'); // Light theme background
});
```

### Performance tests
**Metrics to measure**:
1. **Settings load time**: `GET_SETTINGS` IPC < 50ms
2. **Settings update time**: `UPDATE_SETTINGS` IPC < 100ms
3. **Theme switch time**: CSS repaint < 16ms (one frame)
4. **Settings search**: Filter 100+ settings < 50ms

**Tools**: Playwright performance API, Chrome DevTools Performance tab

## Rollout / migration

### Phase 1: Contracts + IPC (breaking change for preload)
**Tasks**:
1. Define `SettingsSchema` in `packages/api-contracts`
2. Add IPC channels to `ipc-channels.ts`
3. Extend `PreloadAPI` interface
4. Build `api-contracts` package

**Impact**: `window.api` type changes; renderer code must update imports

### Phase 2: Main process (no UI impact)
**Tasks**:
1. Implement `SettingsService` class
2. Add IPC handlers in `ipc-handlers.ts`
3. Update `preload/index.ts` to expose new methods
4. Unit test SettingsService

**Verification**: Main process tests pass, no UI changes yet

### Phase 3: CSS variables + ThemeProvider
**Tasks**:
1. Define CSS variables in `themes.css`
2. Update Tailwind config to map variables
3. Implement `ThemeProvider` component
4. Wrap `App.tsx` in `<ThemeProvider>`

**Impact**: Existing dark theme should look identical (no visual changes)

### Phase 4: Refactor ui-kit components
**Tasks**:
1. Replace hardcoded Tailwind classes in `ShellLayout`, `ActivityBar`, etc.
2. Update `layout-state.ts` to include `'settings'` icon
3. Verify all components render correctly in dev mode

**Impact**: No visual changes if CSS variables match old hardcoded colors

### Phase 5: Settings UI
**Tasks**:
1. Implement `SettingsPanel`, `SettingItem`, form controls
2. Add settings icon to Activity Bar
3. Wire up settings icon click handler
4. Test theme switching in running app

**Verification**: Settings panel accessible, theme switching works

### Phase 6: Testing + polish
**Tasks**:
1. Write unit tests for all new components
2. Write E2E tests for theme switching + persistence
3. Test error scenarios (corrupted file, write failure)
4. Performance profiling

### Migration notes
- **No data migration**: settings.json is new file, no existing data
- **No breaking changes for users**: Layout state (localStorage) unchanged
- **Breaking change for extensions** (future): Extensions must use CSS variables for theming

## Risks + mitigations

### Risk 1: CSS variable browser compatibility
**Likelihood**: Low (CSS variables supported in Chromium 49+, Electron uses Chromium 130+)
**Impact**: High (themes won't work)
**Mitigation**: 
- Test in Electron's Chromium version during development
- Fallback to hardcoded dark theme if CSS variables fail (detect via `getComputedStyle`)

### Risk 2: Performance regression from CSS variable repaints
**Likelihood**: Medium (changing `:root` CSS variables triggers full repaint)
**Impact**: Medium (theme switch feels sluggish)
**Mitigation**:
- Batch CSS variable changes in single `requestAnimationFrame`
- Use `will-change: color, background-color` on theme-switching elements
- Measure repaint time in E2E tests (must be < 16ms)

### Risk 3: Zod schema drift between main and renderer
**Likelihood**: Low (Zod schema defined in contracts package, shared by both)
**Impact**: High (validation mismatches, runtime errors)
**Mitigation**:
- Always build `api-contracts` before `electron-shell` (Turborepo dependency)
- Add CI check to ensure contracts build before apps

### Risk 4: Settings file corruption in production
**Likelihood**: Low (JSON.stringify is reliable, OS file system errors rare)
**Impact**: Medium (user loses settings, app still functions with defaults)
**Mitigation**:
- Atomic write: Write to `settings.json.tmp`, then rename (prevents partial writes)
- Checksum validation: Add `_version` field to detect format changes
- User documentation: Explain where settings.json lives and how to manually reset

### Risk 5: Hardcoded colors missed during refactor
**Likelihood**: Medium (ui-kit has 37+ tests, but not all check colors)
**Impact**: Low (some components don't theme correctly)
**Mitigation**:
- Grep codebase for hardcoded Tailwind colors: `bg-gray-\d`, `text-white`, etc.
- Add E2E screenshot tests for each theme (visual regression)
- Manual QA: Toggle through all themes and verify all UI regions change

### Risk 6: System theme detection fails on Linux
**Likelihood**: Medium (some Linux DEs don't expose `prefers-color-scheme`)
**Impact**: Low (system theme falls back to dark)
**Mitigation**:
- Document system theme requirements (GNOME, KDE supported; i3, Sway may not work)
- Add "Detected theme: dark/light" indicator in settings UI
- Allow users to manually override if detection fails

## Done definition

### Acceptance criteria (from spec)
All 24 acceptance criteria from `spec.md` must pass:
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

### Verification commands
```bash
# 1. Type checking
pnpm -r typecheck

# 2. Linting
pnpm -r lint

# 3. Unit tests (main + renderer)
pnpm --filter apps-electron-shell test

# 4. Build contracts first
pnpm --filter packages-api-contracts build

# 5. Build electron-shell
pnpm --filter apps-electron-shell build

# 6. E2E tests (requires packaged app)
pnpm test:e2e

# 7. Manual verification: Run app, switch themes, restart, verify persistence
pnpm dev
```

### Manual QA checklist
- [ ] Launch app, verify dark theme by default
- [ ] Open Settings via Activity Bar, verify categories render
- [ ] Switch to light theme, verify immediate visual change
- [ ] Switch to high-contrast-dark, verify all UI regions change
- [ ] Switch to system theme, verify follows OS preference
- [ ] Search for "theme", verify filtered results
- [ ] Toggle boolean setting, verify persists after restart
- [ ] Change font size, verify text size updates
- [ ] Click Reset Settings, verify all settings restored
- [ ] Delete settings.json, restart app, verify falls back to defaults
- [ ] Corrupt settings.json (invalid JSON), restart app, verify falls back to defaults

### Documentation updates
- [ ] Update `README.md` with theme switching instructions
- [ ] Update `docs/architecture.md` with settings architecture section
- [ ] Update `CONTRIBUTING.md` with CSS variable guidelines
- [ ] Add inline comments to CSS variables explaining each token

### Performance verification
- [ ] Settings load time < 50ms (DevTools Network tab)
- [ ] Theme switch repaint < 16ms (DevTools Performance tab)
- [ ] Settings search < 50ms for 100+ settings (console.time)
- [ ] Bundle size increase ≤ 80KB (check webpack stats)
