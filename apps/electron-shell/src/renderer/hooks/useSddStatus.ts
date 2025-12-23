import { useEffect, useState } from 'react';
import { SETTINGS_DEFAULTS, type Settings, type SddStatus } from 'packages-api-contracts';

type SettingsUpdateListener = (event: { detail?: Settings }) => void;

type UseSddStatusResult = {
  enabled: boolean;
  status: SddStatus | null;
};

/**
 * useSddStatus - tracks SDD enabled flag and status updates from preload.
 */
export function useSddStatus(workspacePath?: string | null): UseSddStatusResult {
  const [enabled, setEnabled] = useState(SETTINGS_DEFAULTS?.sdd?.enabled ?? false);
  const [status, setStatus] = useState<SddStatus | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      if (typeof window.api?.getSettings !== 'function') {
        return;
      }
      try {
        const settings = await window.api.getSettings();
        if (isMounted) {
          setEnabled(settings.sdd.enabled);
        }
      } catch (error) {
        console.error('Failed to load SDD settings:', error);
      }
    };

    const settingsEventTarget = window as unknown as {
      addEventListener: (type: string, listener: SettingsUpdateListener) => void;
      removeEventListener: (type: string, listener: SettingsUpdateListener) => void;
    };

    const handleSettingsUpdated: SettingsUpdateListener = (event) => {
      const updated = event.detail;
      if (updated?.sdd) {
        setEnabled(updated.sdd.enabled);
      }
    };

    void loadSettings();
    settingsEventTarget.addEventListener('ai-shell:settings-updated', handleSettingsUpdated);

    return () => {
      isMounted = false;
      settingsEventTarget.removeEventListener('ai-shell:settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !workspacePath) {
      setStatus(null);
      return;
    }

    if (typeof window.api?.sdd?.status !== 'function') {
      setStatus(null);
      return;
    }

    let isActive = true;
    const unsubscribe = window.api.sdd.onChange?.((_event, nextStatus) => {
      if (isActive) {
        setStatus(nextStatus);
      }
    });

    const loadStatus = async () => {
      try {
        const next = await window.api.sdd.status();
        if (isActive) {
          setStatus(next);
        }
      } catch (error) {
        console.error('Failed to load SDD status:', error);
        if (isActive) {
          setStatus(null);
        }
      }
    };

    void loadStatus();

    return () => {
      isActive = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [enabled, workspacePath]);

  return { enabled, status };
}
