import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Settings, Theme } from 'packages-api-contracts';
import { SearchBar } from './SearchBar';
import { SettingsCategoryNav, type SettingsCategory } from './SettingsCategoryNav';
import { SettingItem, type SettingType } from './SettingItem';

/**
 * Setting definition for rendering.
 */
interface SettingDefinition {
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

/**
 * Categories for settings navigation.
 */
const CATEGORIES: SettingsCategory[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'extensions', label: 'Extensions' },
];

/**
 * All settings definitions.
 */
const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  // Appearance settings
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
  
  // Editor settings
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
  
  // Extension settings
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
];

/**
 * SettingsPanel component - Main settings UI with category navigation and search.
 * 
 * Features:
 * - Fetches settings via window.api.getSettings() on mount
 * - Two-column layout: left sidebar (categories), right content (settings + search)
 * - Debounced window.api.updateSettings() (300ms) on setting change
 * - Search filters settings across all categories
 * 
 * P1 (Process isolation): Uses only window.api.* (no direct IPC)
 * P6 (Contracts-first): All settings updates validated by Zod in main process
 * P5 (Performance budgets): Settings search uses memoization
 * 
 * @example
 * ```tsx
 * <SettingsPanel />
 * ```
 */
export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line no-undef
  const [updateTimeoutId, setUpdateTimeoutId] = useState<NodeJS.Timeout | null>(null);

  /**
   * Fetch settings on mount
   */
  useEffect(() => {
    async function fetchSettings() {
      try {
        const fetchedSettings = await window.api.getSettings();
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    }

    void fetchSettings();
  }, []);

  /**
   * Handle category click - updates active category and clears search
   */
  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    setSearchQuery('');
  }, []);

  /**
   * Debounced settings update (300ms)
   */
  const handleSettingChange = useCallback((key: string, value: string | number | boolean) => {
    if (!settings) return;

    const settingDef = SETTINGS_DEFINITIONS.find((def) => def.key === key);
    if (!settingDef) return;

    // Update local state immediately for responsiveness
    const updates = settingDef.setValue(settings, value);
    const newSettings = {
      ...settings,
      appearance: { ...settings.appearance, ...updates.appearance },
      editor: { ...settings.editor, ...updates.editor },
      extensions: { ...settings.extensions, ...updates.extensions },
    };
    setSettings(newSettings);

    // Clear previous timeout
    if (updateTimeoutId) {
      clearTimeout(updateTimeoutId);
    }

    // Debounce API call
    const timeoutId = setTimeout(async () => {
      try {
        await window.api.updateSettings(updates);
      } catch (error) {
        console.error('Failed to update settings:', error);
      }
    }, 300);

    setUpdateTimeoutId(timeoutId);
  }, [settings, updateTimeoutId]);

  /**
   * Filter settings by category and search query (memoized for performance)
   */
  const filteredSettings = useMemo(() => {
    if (!settings) return [];

    let filtered = SETTINGS_DEFINITIONS;

    // Filter by search query (case-insensitive substring match on label/description/key)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((def) =>
        def.label.toLowerCase().includes(query) ||
        def.description.toLowerCase().includes(query) ||
        def.key.toLowerCase().includes(query)
      );
    } else {
      // Filter by category only if no search query
      filtered = filtered.filter((def) => def.category === activeCategory);
    }

    return filtered;
  }, [settings, activeCategory, searchQuery]);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - Categories */}
      <div className="w-48 flex-shrink-0 p-4 border-r border-border">
        <h2 className="text-sm font-semibold text-primary mb-4 uppercase tracking-wide">
          Settings
        </h2>
        <SettingsCategoryNav
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onCategoryClick={handleCategoryClick}
        />
      </div>

      {/* Right content - Settings list */}
      <div className="flex-1 overflow-auto p-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search settings..."
        />

        {/* Category title (hidden when searching) */}
        {!searchQuery && (
          <h3 className="text-lg font-semibold text-primary mb-4">
            {CATEGORIES.find((cat) => cat.id === activeCategory)?.label}
          </h3>
        )}

        {/* Settings list */}
        {filteredSettings.length === 0 ? (
          <p className="text-secondary text-sm">
            {searchQuery ? 'No settings match your search.' : 'No settings in this category.'}
          </p>
        ) : (
          <div>
            {filteredSettings.map((def) => (
              <SettingItem
                key={def.key}
                label={def.label}
                description={def.description}
                value={def.getValue(settings)}
                type={def.type}
                options={def.options}
                onChange={(value) => handleSettingChange(def.key, value)}
                min={def.min}
                max={def.max}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
