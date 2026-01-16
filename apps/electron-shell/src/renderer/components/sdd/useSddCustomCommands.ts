import { useEffect, useState } from 'react';
import type { SddCustomCommand } from 'packages-api-contracts';
import { validateCustomCommands, type CustomSlashCommand } from './SddPanel.utils';

type UseSddCustomCommandsResult = {
  customCommands: CustomSlashCommand[];
  customCommandErrors: string[];
};

export function useSddCustomCommands(): UseSddCustomCommandsResult {
  const [customCommands, setCustomCommands] = useState<CustomSlashCommand[]>([]);
  const [customCommandErrors, setCustomCommandErrors] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const settingsEventTarget = window as unknown as {
      addEventListener: (type: string, listener: (event: { detail?: unknown }) => void) => void;
      removeEventListener: (type: string, listener: (event: { detail?: unknown }) => void) => void;
    };

    const applyCommands = (commands: SddCustomCommand[]) => {
      const result = validateCustomCommands(commands);
      if (isMounted) {
        setCustomCommands(result.commands);
        setCustomCommandErrors(result.errors);
      }
    };

    const loadCommands = async () => {
      if (typeof window.api?.getSettings !== 'function') {
        return;
      }
      try {
        const settings = await window.api.getSettings();
        applyCommands(settings.sdd?.customCommands ?? []);
      } catch (loadError) {
        if (isMounted) {
          setCustomCommandErrors([
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load custom slash commands.',
          ]);
        }
      }
    };

    const handleSettingsUpdated = (event: { detail?: unknown }) => {
      const detail = event.detail as any;
      applyCommands(detail?.sdd?.customCommands ?? []);
    };

    void loadCommands();
    settingsEventTarget.addEventListener('ai-shell:settings-updated', handleSettingsUpdated);

    return () => {
      isMounted = false;
      settingsEventTarget.removeEventListener('ai-shell:settings-updated', handleSettingsUpdated);
    };
  }, []);

  return { customCommands, customCommandErrors };
}
