import type { AgentSkillDescriptor } from 'packages-api-contracts';
import { Badge } from 'packages-ui-kit';

type SkillsListItemProps = {
  skill: AgentSkillDescriptor;
  isSelected: boolean;
  isDefault: boolean;
  isLastUsed: boolean;
  onSelect: () => void;
  onToggleEnabled: (enabled: boolean) => void;
};

const skillLabel = (skill: AgentSkillDescriptor): string =>
  `${skill.definition.name} (${skill.definition.id})`;

const metaBadgeClassName =
  'px-[var(--vscode-space-2)] py-[2px] text-[var(--font-size-badge)] leading-[1.15]';
const listItemInsetClassName = 'pl-[var(--vscode-space-4)] pr-[var(--vscode-space-5)]';

export function SkillsListItem({
  skill,
  isSelected,
  isDefault,
  isLastUsed,
  onSelect,
  onToggleEnabled,
}: SkillsListItemProps) {
  return (
    <div
      className={`w-full border-b border-border-subtle py-2.5 ${listItemInsetClassName} ${
        isSelected ? 'bg-[var(--vscode-list-activeSelectionBackground)]' : 'hover:bg-surface-hover'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-none text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <div className="break-words text-[13px] leading-tight text-primary">{skillLabel(skill)}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            label={skill.source}
            variant={skill.source === 'extension' ? 'info' : 'muted'}
            className={metaBadgeClassName}
          />
          <Badge label={skill.scope} variant="muted" className={metaBadgeClassName} />
          {isDefault ? <Badge label="Default" variant="success" className={metaBadgeClassName} /> : null}
          {isLastUsed ? <Badge label="Last used" variant="warning" className={metaBadgeClassName} /> : null}
        </div>
      </button>
      <div className="mt-2 border-t border-border-subtle/80 pt-2">
        <label className="inline-flex h-[var(--size-list-row)] items-center gap-2 text-[12px] leading-none text-secondary">
          <input
            type="checkbox"
            checked={skill.enabled}
            className="h-4 w-4 align-middle accent-[var(--vscode-accent)]"
            onChange={(event) => onToggleEnabled(event.target.checked)}
          />
          Enabled
        </label>
      </div>
    </div>
  );
}
