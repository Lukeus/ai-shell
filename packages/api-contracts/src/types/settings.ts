import { z } from 'zod';

/**
 * Theme options for the application.
 * 
 * @remarks
 * - dark: Default dark theme
 * - light: Light theme for daytime use
 * - high-contrast-dark: High contrast dark for accessibility
 * - high-contrast-light: High contrast light for accessibility
 * - system: Follows OS light/dark mode preference
 */
export const ThemeSchema = z.enum([
  'dark',
  'light',
  'high-contrast-dark',
  'high-contrast-light',
  'system'
]);

/**
 * Theme type inferred from ThemeSchema.
 */
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Icon theme options.
 */
export const IconThemeSchema = z.enum(['default', 'minimal']);

/**
 * Icon theme type inferred from IconThemeSchema.
 */
export type IconTheme = z.infer<typeof IconThemeSchema>;

/**
 * Appearance settings (theme, font size, icon theme).
 * 
 * Controls visual aspects of the application including color theme,
 * base font size, and icon style.
 * 
 * @example
 * ```typescript
 * const appearance = AppearanceSettingsSchema.parse({
 *   theme: 'light',
 *   fontSize: 16,
 *   iconTheme: 'minimal'
 * });
 * ```
 */
export const AppearanceSettingsSchema = z.object({
  /** Active color theme (default: 'dark') */
  theme: ThemeSchema.default('dark'),
  
  /** Base font size in pixels (min: 10, max: 24, default: 14) */
  fontSize: z.number().int().min(10).max(24).default(14),
  
  /** Icon theme style (default: 'default') */
  iconTheme: IconThemeSchema.default('default'),

  /** Show the top menu bar (default: true) */
  menuBarVisible: z.boolean().default(true),
});

/**
 * Appearance settings type inferred from AppearanceSettingsSchema.
 */
export type AppearanceSettings = z.infer<typeof AppearanceSettingsSchema>;

/**
 * Editor settings (placeholders for future Monaco integration).
 * 
 * @remarks
 * These are placeholder settings for editor behavior. Full Monaco editor
 * integration will be implemented in a separate spec.
 */
export const EditorSettingsSchema = z.object({
  /** Enable word wrapping (default: false) */
  wordWrap: z.boolean().default(false),
  
  /** Show line numbers in editor (default: true) */
  lineNumbers: z.boolean().default(true),
  
  /** Show minimap on right side of editor (default: true) */
  minimap: z.boolean().default(true),

  /** Show editor breadcrumbs (default: true) */
  breadcrumbsEnabled: z.boolean().default(true),
});

/**
 * Editor settings type inferred from EditorSettingsSchema.
 */
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

/**
 * Extension settings.
 * 
 * Controls extension behavior including automatic updates and telemetry.
 */
export const ExtensionSettingsSchema = z.object({
  /** Automatically update extensions (default: true) */
  autoUpdate: z.boolean().default(true),
  
  /** Enable telemetry for extensions (default: false) */
  enableTelemetry: z.boolean().default(false),
});

/**
 * Extension settings type inferred from ExtensionSettingsSchema.
 */
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

/**
 * Root settings schema.
 * 
 * Top-level settings object with nested categories for appearance, editor,
 * and extension configuration. All settings persist to disk and are validated
 * with Zod before being saved.
 * 
 * @remarks
 * Security: This schema contains NO secrets. API keys, tokens, and passwords
 * must be stored via Electron's safeStorage API, not in settings.json.
 * 
 * @example
 * ```typescript
 * const settings = SettingsSchema.parse({
 *   appearance: { theme: 'dark', fontSize: 14 },
 *   editor: { wordWrap: true },
 *   extensions: { autoUpdate: true }
 * });
 * ```
 */
export const SettingsSchema = z.object({
  /** Appearance and theming settings */
  appearance: AppearanceSettingsSchema,
  
  /** Editor behavior settings */
  editor: EditorSettingsSchema,
  
  /** Extension management settings */
  extensions: ExtensionSettingsSchema,
});

/**
 * Settings type inferred from SettingsSchema.
 * 
 * This is the complete settings object structure used throughout the application.
 * All settings are persisted to app.getPath('userData')/settings.json.
 */
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Default settings used on first launch or when resetting.
 * 
 * All fields use their schema-defined defaults:
 * - Theme: dark
 * - Font size: 14px
 * - Icon theme: default
 * - Menu bar visible: true
 * - Editor: no word wrap, line numbers on, minimap on, breadcrumbs on
 * - Extensions: auto-update on, telemetry off
 */
export const SETTINGS_DEFAULTS: Settings = SettingsSchema.parse({
  appearance: {},
  editor: {},
  extensions: {},
});

/**
 * Partial settings type for updates.
 * 
 * Allows updating a subset of settings without providing the full object.
 * Useful for incremental updates via updateSettings() IPC call.
 * 
 * @example
 * ```typescript
 * // Only update theme, leave other settings unchanged
 * const updates: PartialSettings = {
 *   appearance: { theme: 'light' }
 * };
 * ```
 */
export type PartialSettings = z.infer<ReturnType<typeof SettingsSchema.deepPartial>>;
