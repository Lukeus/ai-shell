import { ipcMain } from 'electron';
import { IPC_CHANNELS, type PartialSettings, type Settings } from 'packages-api-contracts';
import { settingsService } from '../services/SettingsService';
import { applySddSettings } from './sdd';

export const registerSettingsHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async (): Promise<Settings> => {
    return settingsService.getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_SETTINGS,
    async (_event, updates: PartialSettings): Promise<Settings> => {
      const previous = settingsService.getSettings();
      const updated = settingsService.updateSettings(updates);
      if (previous.sdd.enabled !== updated.sdd.enabled) {
        void applySddSettings(updated);
      }
      return updated;
    }
  );

  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async (): Promise<Settings> => {
    const previous = settingsService.getSettings();
    const reset = settingsService.resetSettings();
    if (previous.sdd.enabled !== reset.sdd.enabled) {
      void applySddSettings(reset);
    }
    return reset;
  });
};
