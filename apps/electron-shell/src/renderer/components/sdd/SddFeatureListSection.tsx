import React from 'react';
import type { SddFeatureSummary } from 'packages-api-contracts';

type SddFeatureListSectionProps = {
  features: SddFeatureSummary[];
  selectedFeatureId: string | null;
  isLoading: boolean;
  onSelect: (featureId: string) => void;
};

export function SddFeatureListSection({
  features,
  selectedFeatureId,
  isLoading,
  onSelect,
}: SddFeatureListSectionProps) {
  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center justify-between text-secondary"
        style={{ padding: 'var(--vscode-space-2)' }}
      >
        <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
          Features
        </span>
        <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
          {features.length}
        </span>
      </div>

      {isLoading ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          Loading specs...
        </div>
      ) : features.length === 0 ? (
        <div
          className="text-tertiary"
          style={{
            paddingLeft: 'var(--vscode-space-3)',
            paddingRight: 'var(--vscode-space-3)',
            paddingBottom: 'var(--vscode-space-2)',
            fontSize: 'var(--vscode-font-size-small)',
          }}
        >
          No specs detected.
        </div>
      ) : (
        <div className="flex flex-col">
          {features.map((feature) => {
            const isSelected = feature.featureId === selectedFeatureId;
            return (
              <button
                key={feature.featureId}
                onClick={() => onSelect(feature.featureId)}
                className={`
                  text-left hover:bg-surface-hover
                  transition-colors duration-150
                  ${isSelected ? 'bg-surface-hover text-primary' : 'text-secondary'}
                `}
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingTop: 'var(--vscode-space-2)',
                  paddingBottom: 'var(--vscode-space-2)',
                  fontSize: 'var(--vscode-font-size-ui)',
                }}
              >
                {feature.featureId}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
