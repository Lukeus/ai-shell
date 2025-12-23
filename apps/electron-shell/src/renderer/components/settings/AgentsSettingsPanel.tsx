import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Connection, Settings, PartialSettings } from 'packages-api-contracts';
import { Select } from 'packages-ui-kit';

type AgentsSettingsPanelProps = {
  settings: Settings;
  onSettingsUpdate: (updates: PartialSettings) => Promise<void>;
};

export function AgentsSettingsPanel({ settings, onSettingsUpdate }: AgentsSettingsPanelProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refreshConnections = useCallback(async () => {
    try {
      setError(null);
      const response = await window.api.connections.list();
      setConnections(response.connections);
    } catch (err) {
      console.error('Failed to load connections:', err);
      setError('Failed to load connections.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  const defaultConnectionId = settings.agents.defaultConnectionId;
  const hasDefault =
    defaultConnectionId !== null &&
    connections.some((connection) => connection.metadata.id === defaultConnectionId);
  const resolvedDefaultId = hasDefault ? defaultConnectionId : null;

  const options = useMemo(() => {
    const base = [{ value: '', label: 'None' }];
    const connectionOptions = connections.map((connection) => ({
      value: connection.metadata.id,
      label: connection.metadata.displayName,
    }));
    return base.concat(connectionOptions);
  }, [connections]);

  const handleDefaultChange = useCallback(
    async (value: string) => {
      const nextValue = value ? value : null;
      setIsSaving(true);
      try {
        await onSettingsUpdate({ agents: { defaultConnectionId: nextValue } });
      } finally {
        setIsSaving(false);
      }
    },
    [onSettingsUpdate]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-secondary">
        Loading agent settings...
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto"
      style={{
        paddingLeft: 'var(--vscode-space-4)',
        paddingRight: 'var(--vscode-space-4)',
        paddingTop: 'var(--vscode-space-3)',
        paddingBottom: 'var(--vscode-space-4)',
      }}
    >
      <h3
        className="text-primary"
        style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: 'var(--vscode-space-3)',
        }}
      >
        Agents
      </h3>

      {error && (
        <div className="mb-3 text-xs text-status-error border border-border-subtle px-3 py-2">
          {error}
        </div>
      )}

      <div className="max-w-[420px] space-y-2">
        <label className="block text-[13px] font-medium text-primary">
          Default connection
        </label>
        <Select
          value={resolvedDefaultId ?? ''}
          onChange={handleDefaultChange}
          options={options}
          disabled={isSaving || connections.length === 0}
          className="w-full bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]"
        />
        <div className="text-[11px] text-secondary">
          Used when a run does not specify a connection.
        </div>
        {!hasDefault && defaultConnectionId && (
          <div className="text-[11px] text-status-warning">
            The saved default connection no longer exists. Select a new default or choose
            None.
          </div>
        )}
        {connections.length === 0 && (
          <div className="text-[11px] text-secondary">
            Create a connection in the Connections tab to select a default.
          </div>
        )}
      </div>
    </div>
  );
}
