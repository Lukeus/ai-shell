import React from 'react';
import type { ExtensionRegistryItem } from 'packages-api-contracts';
import { Badge } from 'packages-ui-kit';
import {
  dangerActionButtonClassName,
  neutralActionButtonClassName,
} from '../shared/controlClassNames';

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
            <Badge
              label={enabled ? 'Enabled' : 'Disabled'}
              variant={enabled ? 'success' : 'muted'}
            />
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
            className={neutralActionButtonClassName}
            type="button"
          >
            {enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => onShowPermissions(extension)}
            className={neutralActionButtonClassName}
            type="button"
          >
            Permissions
          </button>
          <button
            onClick={() => onUninstall(extension)}
            className={dangerActionButtonClassName}
            type="button"
          >
            Uninstall
          </button>
        </div>
      </div>
      {permissions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((scope) => (
            <Badge
              key={scope}
              label={formatPermission(scope)}
              variant="muted"
            />
          ))}
        </div>
      )}
    </div>
  );
}
