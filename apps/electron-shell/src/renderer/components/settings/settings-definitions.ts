import type { Settings, Theme } from 'packages-api-contracts';
import type { SettingsCategory } from './SettingsCategoryNav';
import type { SettingType } from './SettingItem';

export interface SettingDefinition {
  key: string;
  category: string;
  label: string;
  description: string;
  type: SettingType;
  getValue: (settings: Settings) => string | number | boolean;
  setValue: (settings: Settings, value: string | number | boolean) => Partial<Settings>;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export const CATEGORIES: SettingsCategory[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'agents', label: 'Agents' },
  { id: 'skills', label: 'Skills' },
  { id: 'sdd', label: 'SDD' },
  { id: 'connections', label: 'Connections' },
  { id: 'extensions', label: 'Extensions' },
];

export const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'appearance.theme',
    category: 'appearance',
    label: 'Theme',
    description: 'Choose your color theme',
    type: 'enum',
    getValue: (settings) => settings.appearance.theme,
    setValue: (settings, value) => ({
      appearance: {
        ...settings.appearance,
        theme: value as Theme,
      },
    }),
    options: [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
      { value: 'high-contrast-dark', label: 'High Contrast Dark' },
      { value: 'high-contrast-light', label: 'High Contrast Light' },
      { value: 'system', label: 'System' },
    ],
  },
  {
    key: 'appearance.fontSize',
    category: 'appearance',
    label: 'Font Size',
    description: 'Base font size in pixels (10-24)',
    type: 'number',
    getValue: (settings) => settings.appearance.fontSize,
    setValue: (settings, value) => ({
      appearance: {
        ...settings.appearance,
        fontSize: Number(value),
      },
    }),
    min: 10,
    max: 24,
  },
  {
    key: 'appearance.iconTheme',
    category: 'appearance',
    label: 'Icon Theme',
    description: 'Icon style for the UI',
    type: 'enum',
    getValue: (settings) => settings.appearance.iconTheme,
    setValue: (settings, value) => ({
      appearance: {
        ...settings.appearance,
        iconTheme: value as 'default' | 'minimal',
      },
    }),
    options: [
      { value: 'default', label: 'Default' },
      { value: 'minimal', label: 'Minimal' },
    ],
  },
  {
    key: 'appearance.menuBarVisible',
    category: 'appearance',
    label: 'Show Menu Bar',
    description: 'Display the top menu bar',
    type: 'boolean',
    getValue: (settings) => settings.appearance.menuBarVisible,
    setValue: (settings, value) => ({
      appearance: {
        ...settings.appearance,
        menuBarVisible: Boolean(value),
      },
    }),
  },
  {
    key: 'editor.wordWrap',
    category: 'editor',
    label: 'Word Wrap',
    description: 'Enable word wrapping in editor',
    type: 'boolean',
    getValue: (settings) => settings.editor.wordWrap,
    setValue: (settings, value) => ({
      editor: {
        ...settings.editor,
        wordWrap: Boolean(value),
      },
    }),
  },
  {
    key: 'editor.lineNumbers',
    category: 'editor',
    label: 'Line Numbers',
    description: 'Show line numbers in editor',
    type: 'boolean',
    getValue: (settings) => settings.editor.lineNumbers,
    setValue: (settings, value) => ({
      editor: {
        ...settings.editor,
        lineNumbers: Boolean(value),
      },
    }),
  },
  {
    key: 'editor.minimap',
    category: 'editor',
    label: 'Minimap',
    description: 'Show minimap on right side of editor',
    type: 'boolean',
    getValue: (settings) => settings.editor.minimap,
    setValue: (settings, value) => ({
      editor: {
        ...settings.editor,
        minimap: Boolean(value),
      },
    }),
  },
  {
    key: 'editor.breadcrumbsEnabled',
    category: 'editor',
    label: 'Show Breadcrumbs',
    description: 'Display file and symbol breadcrumbs below tabs',
    type: 'boolean',
    getValue: (settings) => settings.editor.breadcrumbsEnabled,
    setValue: (settings, value) => ({
      editor: {
        ...settings.editor,
        breadcrumbsEnabled: Boolean(value),
      },
    }),
  },
  {
    key: 'extensions.autoUpdate',
    category: 'extensions',
    label: 'Auto Update',
    description: 'Automatically update extensions',
    type: 'boolean',
    getValue: (settings) => settings.extensions.autoUpdate,
    setValue: (settings, value) => ({
      extensions: {
        ...settings.extensions,
        autoUpdate: Boolean(value),
      },
    }),
  },
  {
    key: 'extensions.enableTelemetry',
    category: 'extensions',
    label: 'Telemetry',
    description: 'Enable telemetry for extensions',
    type: 'boolean',
    getValue: (settings) => settings.extensions.enableTelemetry,
    setValue: (settings, value) => ({
      extensions: {
        ...settings.extensions,
        enableTelemetry: Boolean(value),
      },
    }),
  },
  {
    key: 'terminal.defaultShell',
    category: 'terminal',
    label: 'Default Shell',
    description: 'Default shell for new terminal sessions',
    type: 'enum',
    getValue: (settings) => settings.terminal.defaultShell,
    setValue: (settings, value) => ({
      terminal: {
        ...settings.terminal,
        defaultShell: value as 'default' | 'powershell' | 'pwsh' | 'cmd',
      },
    }),
    options: [
      { value: 'default', label: 'System Default' },
      { value: 'powershell', label: 'Windows PowerShell' },
      { value: 'pwsh', label: 'PowerShell (pwsh)' },
      { value: 'cmd', label: 'Command Prompt' },
    ],
  },
  {
    key: 'sdd.enabled',
    category: 'sdd',
    label: 'Enable SDD',
    description: 'Enable spec-driven tracing and parity metrics',
    type: 'boolean',
    getValue: (settings) => settings.sdd.enabled,
    setValue: (settings, value) => ({
      sdd: {
        ...settings.sdd,
        enabled: Boolean(value),
      },
    }),
  },
  {
    key: 'sdd.blockCommitOnUntrackedCodeChanges',
    category: 'sdd',
    label: 'Block Commit on Untracked Changes',
    description: 'Prevent commits when code changes are untracked',
    type: 'boolean',
    getValue: (settings) => settings.sdd.blockCommitOnUntrackedCodeChanges,
    setValue: (settings, value) => ({
      sdd: {
        ...settings.sdd,
        blockCommitOnUntrackedCodeChanges: Boolean(value),
      },
    }),
  },
];
