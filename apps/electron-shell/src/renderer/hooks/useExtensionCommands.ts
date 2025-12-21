import { useCallback, useEffect, useState } from 'react';
import type { CommandContribution } from 'packages-api-contracts';

type ExtensionCommandsState = {
  commands: CommandContribution[];
  isLoading: boolean;
  error: string | null;
};

export function useExtensionCommands(enabled: boolean) {
  const [state, setState] = useState<ExtensionCommandsState>({
    commands: [],
    isLoading: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const commands = await window.api.extensions.listCommands();
      setState({ commands, isLoading: false, error: null });
    } catch (err) {
      console.error('Failed to load extension commands:', err);
      setState({
        commands: [],
        isLoading: false,
        error: 'Failed to load extension commands.',
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  return {
    commands: state.commands,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
