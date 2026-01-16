import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExtensionRegistryItem, McpServerListItem, PermissionGrant } from 'packages-api-contracts';
import { SearchBar } from '../settings/SearchBar';
import { ExtensionCard } from './ExtensionCard';
import { ConfirmUninstallModal } from './ConfirmUninstallModal';
import { PermissionDialog } from '../permissions/PermissionDialog';
import { useMcpServers } from '../../hooks/useMcpServers';
import { McpServersSection } from './McpServersSection';

export function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<ExtensionRegistryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUninstall, setPendingUninstall] = useState<ExtensionRegistryItem | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<ExtensionRegistryItem | null>(null);
  const [permissionGrants, setPermissionGrants] = useState<PermissionGrant[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const {
    servers: mcpServers,
    isLoading: isMcpLoading,
    isRefreshing: isMcpRefreshing,
    error: mcpError,
    refresh: refreshMcpServers,
    startServer: startMcpServer,
    stopServer: stopMcpServer,
    isServerBusy: isMcpServerBusy,
  } = useMcpServers();

  const refreshExtensions = useCallback(async () => {
    try {
      setError(null);
      const response = await window.api.extensions.list();
      setExtensions(response.extensions);
    } catch (err) {
      console.error('Failed to load extensions:', err);
      setError('Failed to load extensions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshExtensions();
  }, [refreshExtensions]);

  const filteredExtensions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...extensions].sort((a, b) => {
      const nameA = (a.manifest.displayName || a.manifest.name).toLowerCase();
      const nameB = (b.manifest.displayName || b.manifest.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (!query) {
      return sorted;
    }

    return sorted.filter((extension) => {
      const manifest = extension.manifest;
      return (
        manifest.id.toLowerCase().includes(query) ||
        manifest.name.toLowerCase().includes(query) ||
        (manifest.displayName?.toLowerCase().includes(query) ?? false) ||
        (manifest.description?.toLowerCase().includes(query) ?? false) ||
        manifest.publisher.toLowerCase().includes(query)
      );
    });
  }, [extensions, searchQuery]);

  const filteredMcpServers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...mcpServers].sort((a, b) => a.name.localeCompare(b.name));

    if (!query) {
      return sorted;
    }

    return sorted.filter((server) => {
      return (
        server.name.toLowerCase().includes(query) ||
        server.serverId.toLowerCase().includes(query) ||
        server.extensionId.toLowerCase().includes(query) ||
        (server.connectionProviderId?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [mcpServers, searchQuery]);

  const handleToggleEnabled = useCallback(
    async (extension: ExtensionRegistryItem) => {
      try {
        setError(null);
        if (extension.enabled) {
          await window.api.extensions.disable({ extensionId: extension.manifest.id });
        } else {
          await window.api.extensions.enable({ extensionId: extension.manifest.id });
        }
        await refreshExtensions();
      } catch (err) {
        console.error('Failed to update extension state:', err);
        setError('Failed to update extension state.');
      }
    },
    [refreshExtensions]
  );

  const handleUninstall = useCallback((extension: ExtensionRegistryItem) => {
    setPendingUninstall(extension);
  }, []);

  const handleConfirmUninstall = useCallback(async () => {
    if (!pendingUninstall) {
      return;
    }

    try {
      setError(null);
      await window.api.extensions.uninstall({ extensionId: pendingUninstall.manifest.id });
      setPendingUninstall(null);
      await refreshExtensions();
    } catch (err) {
      console.error('Failed to uninstall extension:', err);
      setError('Failed to uninstall extension.');
    }
  }, [pendingUninstall, refreshExtensions]);

  const handleCancelUninstall = useCallback(() => {
    setPendingUninstall(null);
  }, []);

  const handleShowPermissions = useCallback(async (extension: ExtensionRegistryItem) => {
    setPermissionTarget(extension);
    setPermissionLoading(true);
    setPermissionError(null);
    try {
      const grants = await window.api.extensions.listPermissions({
        extensionId: extension.manifest.id,
      });
      setPermissionGrants(grants);
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setPermissionError('Failed to load permissions.');
      setPermissionGrants([]);
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  const handleClosePermissions = useCallback(() => {
    setPermissionTarget(null);
    setPermissionGrants([]);
    setPermissionError(null);
  }, []);

  const handleRevokePermissions = useCallback(async () => {
    if (!permissionTarget) {
      return;
    }

    try {
      setPermissionError(null);
      await window.api.extensions.revokePermissions({
        extensionId: permissionTarget.manifest.id,
      });
      const grants = await window.api.extensions.listPermissions({
        extensionId: permissionTarget.manifest.id,
      });
      setPermissionGrants(grants);
    } catch (err) {
      console.error('Failed to revoke permissions:', err);
      setPermissionError('Failed to revoke permissions.');
    }
  }, [permissionTarget]);

  const handleToggleMcpServer = useCallback(
    async (server: McpServerListItem, enabled: boolean) => {
      if (enabled) {
        const confirmed = window.confirm(
          `Enable MCP server "${server.name}" from ${server.extensionId}?`
        );
        if (!confirmed) {
          return;
        }
        await startMcpServer(server);
        return;
      }
      await stopMcpServer(server);
    },
    [startMcpServer, stopMcpServer]
  );

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-surface">
      <div
        className="border-b border-border-subtle bg-surface-secondary shrink-0"
        style={{
          paddingLeft: 'var(--vscode-space-3)',
          paddingRight: 'var(--vscode-space-3)',
          paddingTop: 'var(--vscode-space-2)',
          paddingBottom: 'var(--vscode-space-2)',
        }}
      >
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search extensions and MCP servers..."
        />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-status-error border-b border-border shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <div
          className="flex flex-col gap-6"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingTop: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-4)',
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-secondary text-sm">
              Loading extensions...
            </div>
          ) : filteredExtensions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-secondary">
              <span className="codicon codicon-extensions text-3xl opacity-40" aria-hidden="true" />
              <p className="mt-3 text-sm">No extensions found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredExtensions.map((extension) => (
                <ExtensionCard
                  key={extension.manifest.id}
                  extension={extension}
                  onToggleEnabled={handleToggleEnabled}
                  onShowPermissions={handleShowPermissions}
                  onUninstall={handleUninstall}
                />
              ))}
            </div>
          )}

          <McpServersSection
            servers={filteredMcpServers}
            isLoading={isMcpLoading}
            isRefreshing={isMcpRefreshing}
            error={mcpError}
            onRefresh={refreshMcpServers}
            onToggle={handleToggleMcpServer}
            isServerBusy={isMcpServerBusy}
          />
        </div>
      </div>

      {pendingUninstall && (
        <ConfirmUninstallModal
          extensionName={pendingUninstall.manifest.displayName || pendingUninstall.manifest.name}
          onConfirm={handleConfirmUninstall}
          onCancel={handleCancelUninstall}
        />
      )}

      {permissionTarget && (
        <PermissionDialog
          extensionName={permissionTarget.manifest.displayName || permissionTarget.manifest.name}
          permissions={permissionGrants}
          isLoading={permissionLoading}
          error={permissionError}
          onClose={handleClosePermissions}
          onRevokeAll={handleRevokePermissions}
        />
      )}
    </div>
  );
}
