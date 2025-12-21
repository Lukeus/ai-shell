import React from 'react';
import type { ExtensionRegistryItem } from 'packages-api-contracts';

const formatPermission = (scope: string): string =>
  scope.replace(/\./g, ' ');

interface ExtensionCardProps {
  extension: ExtensionRegistryItem;
  onToggleEnabled: (extension: ExtensionRegistryItem) => void;
  onShowPermissions: (extension: ExtensionRegistryItem) => void;
  onUninstall: (extension: ExtensionRegistryItem) => void;
}

export function ExtensionCard({
  extension,
  onToggleEnabled,
  onShowPermissions,
  onUninstall,
}: ExtensionCardProps) {
  const { manifest, enabled } = extension;
  const displayName = manifest.displayName || manifest.name;
  const description = manifest.description || 'No description provided.';
  const permissions = manifest.permissions ?? [];

  return (
    <div
      className="border border-border-subtle rounded-sm bg-surface-elevated"
      style={{
        padding: 'var(--vscode-space-3)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-primary font-semibold truncate">
              {displayName}
            </h3>
            <span
              className={`text-xs rounded-full px-2 py-0.5 border ${
                enabled
                  ? 'border-status-success text-status-success'
                  : 'border-border-subtle text-tertiary'
              }`}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-secondary text-sm mt-1">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-tertiary">
            <span className="truncate">ID: {manifest.id}</span>
            <span className="opacity-60">•</span>
            <span>v{manifest.version}</span>
            <span className="opacity-60">•</span>
            <span>{manifest.publisher}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => onToggleEnabled(extension)}
            className="px-3 py-1 rounded-sm border border-border-subtle bg-surface hover:bg-surface-hover text-sm text-primary"
          >
            {enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => onShowPermissions(extension)}
            className="px-3 py-1 rounded-sm border border-border-subtle bg-surface hover:bg-surface-hover text-sm text-primary"
          >
            Permissions
          </button>
          <button
            onClick={() => onUninstall(extension)}
            className="px-3 py-1 rounded-sm border border-status-error text-status-error hover:bg-surface-hover text-sm"
          >
            Uninstall
          </button>
        </div>
      </div>
      {permissions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((scope) => (
            <span
              key={scope}
              className="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-secondary"
            >
              {formatPermission(scope)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
