import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings, Theme, PartialSettings } from 'packages-api-contracts';
import { SearchBar } from './SearchBar';
import { SettingsCategoryNav } from './SettingsCategoryNav';
import { SettingItem } from './SettingItem';
import { ConnectionsPanel } from './connections/ConnectionsPanel';
import { AgentsSettingsPanel } from './AgentsSettingsPanel';
import { SkillsPanel } from '../skills/SkillsPanel';
import { useTheme } from '../ThemeProvider';
import { CATEGORIES, SETTINGS_DEFINITIONS } from './settings-definitions';

const mergeSettings = (settings: Settings, updates: PartialSettings): Settings => ({
  ...settings,
  appearance: { ...settings.appearance, ...updates.appearance },
  editor: { ...settings.editor, ...updates.editor },
  terminal: { ...settings.terminal, ...updates.terminal },
  extensions: { ...settings.extensions, ...updates.extensions },
  agents: { ...settings.agents, ...updates.agents },
  sdd: { ...settings.sdd, ...updates.sdd },
});

const publishSettingsUpdated = (settings: Settings): void => {
  window.dispatchEvent(new window.CustomEvent('ai-shell:settings-updated', { detail: settings }));
};

export function SettingsPanel() {
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAgentsCategory = activeCategory === 'agents';
  const isConnectionsCategory = activeCategory === 'connections';
  const isSkillsCategory = activeCategory === 'skills';
  const supportsSearch = !isConnectionsCategory && !isAgentsCategory && !isSkillsCategory;

  const activeCategoryLabel = useMemo(
    () => CATEGORIES.find((category) => category.id === activeCategory)?.label ?? 'Settings',
    [activeCategory]
  );

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

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

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    setSearchQuery('');
  }, []);

  const applySettingsUpdate = useCallback(
    async (updates: PartialSettings) => {
      if (!settings) {
        return;
      }

      const nextSettings = mergeSettings(settings, updates);
      setSettings(nextSettings);
      publishSettingsUpdated(nextSettings);

      try {
        await window.api.updateSettings(updates);
      } catch (error) {
        console.error('Failed to update settings:', error);
      }
    },
    [settings]
  );

  const handleSettingChange = useCallback(
    (key: string, value: string | number | boolean) => {
      if (!settings) {
        return;
      }

      const settingDefinition = SETTINGS_DEFINITIONS.find((definition) => definition.key === key);
      if (!settingDefinition) {
        return;
      }

      const updates = settingDefinition.setValue(settings, value);
      const nextSettings = mergeSettings(settings, updates);
      setSettings(nextSettings);
      publishSettingsUpdated(nextSettings);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      if (key === 'appearance.theme') {
        void setTheme(value as Theme);
        return;
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await window.api.updateSettings(updates);
        } catch (error) {
          console.error('Failed to update settings:', error);
        }
      }, 300);
    },
    [settings, setTheme]
  );

  const filteredSettings = useMemo(() => {
    if (!settings || isConnectionsCategory || isAgentsCategory || isSkillsCategory) {
      return [];
    }

    if (!searchQuery.trim()) {
      return SETTINGS_DEFINITIONS.filter((definition) => definition.category === activeCategory);
    }

    const query = searchQuery.toLowerCase();
    return SETTINGS_DEFINITIONS.filter((definition) =>
      definition.label.toLowerCase().includes(query) ||
      definition.description.toLowerCase().includes(query) ||
      definition.key.toLowerCase().includes(query)
    );
  }, [activeCategory, isAgentsCategory, isConnectionsCategory, isSkillsCategory, searchQuery, settings]);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-secondary">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-surface">
      <div className="flex-shrink-0 border-r border-border-subtle bg-surface-secondary" style={{ width: '220px' }}>
        <div
          className="flex items-center"
          style={{
            height: 'var(--vscode-panelHeader-height)',
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            borderBottom: '1px solid var(--vscode-border-subtle)',
          }}
        >
          <h2
            className="text-primary uppercase"
            style={{
              fontSize: 'var(--vscode-font-size-small)',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            Settings
          </h2>
        </div>
        <SettingsCategoryNav
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onCategoryClick={handleCategoryClick}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-secondary"
          style={{
            height: 'var(--vscode-panelHeader-height)',
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
          }}
        >
          <div className="text-primary" style={{ fontSize: '14px', fontWeight: 600 }}>
            {supportsSearch && searchQuery.trim() ? 'Search Results' : activeCategoryLabel}
          </div>
          {supportsSearch ? (
            <div className="w-full max-w-[320px]">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search settings..."
              />
            </div>
          ) : (
            <div className="w-full max-w-[320px]" />
          )}
        </div>

        {isConnectionsCategory ? <ConnectionsPanel /> : null}
        {isAgentsCategory ? (
          <AgentsSettingsPanel settings={settings} onSettingsUpdate={applySettingsUpdate} />
        ) : null}
        {isSkillsCategory ? <SkillsPanel /> : null}

        {!isConnectionsCategory && !isAgentsCategory && !isSkillsCategory ? (
          <div
            className="flex-1 overflow-auto"
            style={{
              paddingLeft: 'var(--vscode-space-4)',
              paddingRight: 'var(--vscode-space-4)',
              paddingTop: 'var(--vscode-space-3)',
              paddingBottom: 'var(--vscode-space-4)',
            }}
          >
            {filteredSettings.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
                {searchQuery ? 'No settings match your search.' : 'No settings in this category.'}
              </p>
            ) : (
              <div>
                {filteredSettings.map((definition) => (
                  <SettingItem
                    key={definition.key}
                    label={definition.label}
                    description={definition.description}
                    value={definition.getValue(settings)}
                    type={definition.type}
                    options={definition.options}
                    onChange={(value) => handleSettingChange(definition.key, value)}
                    min={definition.min}
                    max={definition.max}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
