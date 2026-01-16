import React from 'react';
import type { McpServerListItem, McpServerState } from 'packages-api-contracts';
import { Badge, type BadgeVariant, ToggleSwitch } from 'packages-ui-kit';

type McpServersSectionProps = {
  servers: McpServerListItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onToggle: (server: McpServerListItem, enabled: boolean) => Promise<void>;
  isServerBusy: (server: McpServerListItem) => boolean;
};

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
};

const STATUS_CONFIG: Record<McpServerState, StatusConfig> = {
  running: { label: 'Running', variant: 'success' },
  starting: { label: 'Starting', variant: 'info' },
  stopping: { label: 'Stopping', variant: 'warning' },
  stopped: { label: 'Stopped', variant: 'muted' },
  failed: { label: 'Failed', variant: 'danger' },
};

const BADGE_CLASSNAME =
  'text-[10px] rounded-sm px-2 py-0.5 normal-case tracking-normal';

const buildServerKey = (server: McpServerListItem): string =>
  `${server.extensionId}:${server.serverId}`;

export function McpServersSection({
  servers,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onToggle,
  isServerBusy,
}: McpServersSectionProps) {
  const hasServers = servers.length > 0;
  const isRefreshDisabled = isLoading || isRefreshing;

  return (
    <section className="border-t border-border-subtle pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">MCP Servers</h2>
          <p className="text-xs text-tertiary">
            Extension-contributed MCP servers and their status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void onRefresh();
          }}
          disabled={isRefreshDisabled}
          className="px-3 py-1 rounded-sm border border-border-subtle bg-surface hover:bg-surface-hover text-sm text-primary disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-xs text-status-error border border-border-subtle px-3 py-2">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 text-sm text-secondary">Loading MCP servers...</div>
      ) : !hasServers ? (
        <div className="mt-4 text-sm text-secondary">
          No MCP servers contributed by extensions.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {servers.map((server) => (
            <McpServerCard
              key={buildServerKey(server)}
              server={server}
              isBusy={isServerBusy(server)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type McpServerCardProps = {
  server: McpServerListItem;
  isBusy: boolean;
  onToggle: (server: McpServerListItem, enabled: boolean) => Promise<void>;
};

function McpServerCard({ server, isBusy, onToggle }: McpServerCardProps) {
  const status = STATUS_CONFIG[server.status.state];
  const messageTone =
    server.status.state === 'failed' ? 'text-status-error' : 'text-secondary';
  const connectionLabel = server.connectionProviderId
    ? server.connectionProviderId
    : 'Default connection';

  return (
    <div
      className="border border-border-subtle rounded-sm bg-surface-elevated"
      style={{
        padding: 'var(--vscode-space-3)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-primary font-semibold truncate">{server.name}</h3>
            <Badge
              label={status.label}
              variant={status.variant}
              className={BADGE_CLASSNAME}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-tertiary">
            <span className="truncate">Extension: {server.extensionId}</span>
            <span className="opacity-60">|</span>
            <span>Server: {server.serverId}</span>
            <span className="opacity-60">|</span>
            <span>Transport: {server.transport}</span>
            <span className="opacity-60">|</span>
            <span>Connection: {connectionLabel}</span>
          </div>
          {server.status.message && (
            <div className={`mt-2 text-xs ${messageTone}`}>
              {server.status.message}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <ToggleSwitch
            checked={server.enabled}
            onChange={(checked) => {
              void onToggle(server, checked);
            }}
            disabled={isBusy}
            label={server.enabled ? 'Enabled' : 'Disabled'}
          />
        </div>
      </div>
    </div>
  );
}
