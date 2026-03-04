import { useMemo, useState } from 'react';
import type { AgentSkillDescriptor, AgentSkillDefinition, SkillScope } from 'packages-api-contracts';
import { Badge, Input, Select } from 'packages-ui-kit';
import { useSkills } from '../../hooks/useSkills';
import { SkillEditor, type SkillEditorDraft } from './SkillEditor';
import { SkillsListItem } from './SkillsListItem';
import {
  neutralActionButtonClassName,
  primaryActionButtonClassName,
} from '../shared/controlClassNames';
type EditorMode = 'create' | 'edit';
const toCsv = (values: string[] | undefined): string => (values ?? []).join(', ');
const sectionHeadingClassName = 'text-[var(--font-size-label)] uppercase tracking-[0.08em] text-secondary';
const skillMetaBadgeClassName = 'px-[var(--vscode-space-2)] py-[2px] text-[var(--font-size-badge)] leading-[1.15]';
const skillsSectionInsetClassName = 'pl-[var(--vscode-space-4)] pr-[var(--vscode-space-6)]';
const skillsSectionBlockClassName = `${skillsSectionInsetClassName} py-[var(--vscode-space-3)]`;
const parseCsv = (value: string): string[] | undefined => {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries : undefined;
};
const createEmptyDraft = (): SkillEditorDraft => ({
  id: '',
  name: '',
  description: '',
  promptTemplate: '',
  toolAllowlist: '',
  toolDenylist: '',
  tags: '',
});

const toDraft = (skill: AgentSkillDescriptor): SkillEditorDraft => ({
  id: skill.definition.id,
  name: skill.definition.name,
  description: skill.definition.description ?? '',
  promptTemplate: skill.definition.promptTemplate ?? '',
  toolAllowlist: toCsv(skill.definition.toolAllowlist),
  toolDenylist: toCsv(skill.definition.toolDenylist),
  tags: toCsv(skill.definition.tags),
});
const toDefinition = (draft: SkillEditorDraft): AgentSkillDefinition => ({
  id: draft.id.trim(),
  name: draft.name.trim(),
  ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
  ...(draft.promptTemplate.trim()
    ? { promptTemplate: draft.promptTemplate.trim() }
    : {}),
  ...(parseCsv(draft.toolAllowlist)
    ? { toolAllowlist: parseCsv(draft.toolAllowlist) }
    : {}),
  ...(parseCsv(draft.toolDenylist)
    ? { toolDenylist: parseCsv(draft.toolDenylist) }
    : {}),
  ...(parseCsv(draft.tags) ? { tags: parseCsv(draft.tags) } : {}),
});
const toUpdates = (draft: SkillEditorDraft): Omit<Partial<AgentSkillDefinition>, 'id'> => ({
  name: draft.name.trim(),
  description: draft.description.trim() || undefined,
  promptTemplate: draft.promptTemplate.trim() || undefined,
  toolAllowlist: parseCsv(draft.toolAllowlist),
  toolDenylist: parseCsv(draft.toolDenylist),
  tags: parseCsv(draft.tags),
});
const matchQuery = (skill: AgentSkillDescriptor, query: string): boolean => {
  if (!query) {
    return true;
  }
  const normalized = query.toLowerCase();
  const tags = skill.definition.tags?.join(' ').toLowerCase() ?? '';
  return (
    skill.definition.id.toLowerCase().includes(normalized) ||
    skill.definition.name.toLowerCase().includes(normalized) ||
    (skill.definition.description ?? '').toLowerCase().includes(normalized) ||
    tags.includes(normalized)
  );
};
export function SkillsPanel() {
  const {
    scope,
    setScope,
    workspaceName,
    canUseWorkspaceScope,
    skills,
    preferences,
    isLoading,
    isSaving,
    error,
    createSkill,
    updateSkill,
    deleteSkill,
    setEnabled,
    setDefaultSkill,
    setLastUsedSkill,
  } = useSkills('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [draft, setDraft] = useState<SkillEditorDraft>(createEmptyDraft());
  const filteredSkills = useMemo(
    () => skills.filter((skill) => matchQuery(skill, searchQuery.trim())),
    [searchQuery, skills]
  );
  const selectedSkill = useMemo(
    () =>
      selectedSkillId
        ? skills.find((skill) => skill.definition.id === selectedSkillId) ?? null
        : null,
    [skills, selectedSkillId]
  );
  const editorDraft = useMemo(() => {
    if (editorMode === 'create') {
      return draft;
    }
    if (!selectedSkill) {
      return createEmptyDraft();
    }
    if (draft.id === selectedSkill.definition.id) {
      return draft;
    }
    return toDraft(selectedSkill);
  }, [draft, editorMode, selectedSkill]);
  const handleSelectSkill = (skill: AgentSkillDescriptor) => {
    setEditorMode('edit');
    setSelectedSkillId(skill.definition.id);
    setDraft(toDraft(skill));
  };

  const handleCreate = () => {
    setEditorMode('create');
    setSelectedSkillId(null);
    setDraft(createEmptyDraft());
  };
  const handleSave = async () => {
    if (editorMode === 'create') {
      const definition = toDefinition(draft);
      await createSkill(definition);
      setEditorMode('edit');
      setSelectedSkillId(definition.id);
      return;
    }

    if (!selectedSkillId) {
      return;
    }

    await updateSkill(selectedSkillId, toUpdates(draft));
  };
  const handleDelete = async () => {
    if (!selectedSkillId || !selectedSkill || selectedSkill.source !== 'user') {
      return;
    }
    await deleteSkill(selectedSkillId);
    setSelectedSkillId(null);
  };
  const handleCancel = () => {
    if (selectedSkill && editorMode !== 'create') {
      setDraft(toDraft(selectedSkill));
      return;
    }
    setEditorMode('edit');
    setDraft(createEmptyDraft());
  };
  const selectedIsDefault = selectedSkill && preferences.defaultSkillId === selectedSkill.definition.id;
  const selectedIsLastUsed = selectedSkill && preferences.lastUsedSkillId === selectedSkill.definition.id;
  const scopeOptions = [
    { value: 'global', label: 'Global skills' },
    {
      value: 'workspace',
      label: canUseWorkspaceScope
        ? `Workspace skills (${workspaceName})`
        : 'Workspace skills (open a folder first)',
      disabled: !canUseWorkspaceScope,
    },
  ];

  return (
    <div className="flex h-full min-h-0">
      <div
        className="flex shrink-0 min-w-[280px] max-w-[360px] flex-col border-r border-border-subtle bg-surface-secondary"
        style={{ flexBasis: '32%' }}
      >
        <div className={`space-y-2.5 border-b border-border-subtle ${skillsSectionBlockClassName}`}>
          <div className="flex items-center justify-between gap-2">
            <div className={sectionHeadingClassName}>Scope</div>
            <div className="text-[var(--font-size-label)] text-tertiary">{filteredSkills.length} shown</div>
          </div>
          <Select
            value={scope}
            onChange={(value) => setScope(value as SkillScope)}
            options={scopeOptions}
            className="w-full bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]"
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(value) => setSearchQuery(String(value))}
            placeholder="Search skills..."
            className="w-full bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)] placeholder:text-tertiary"
          />
          <button
            type="button"
            onClick={handleCreate}
            className={`${neutralActionButtonClassName} w-full`}
          >
            New skill
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className={`${skillsSectionBlockClassName} text-[12px] text-secondary`}>Loading skills...</div>
          ) : null}
          {!isLoading && filteredSkills.length === 0 ? (
            <div className={`${skillsSectionBlockClassName} text-[12px] text-secondary`}>
              No skills match this filter.
            </div>
          ) : null}
          {!isLoading && filteredSkills.length > 0
            ? filteredSkills.map((skill) => (
                <SkillsListItem
                  key={skill.definition.id}
                  skill={skill}
                  isSelected={selectedSkillId === skill.definition.id && editorMode !== 'create'}
                  isDefault={preferences.defaultSkillId === skill.definition.id}
                  isLastUsed={preferences.lastUsedSkillId === skill.definition.id}
                  onSelect={() => handleSelectSkill(skill)}
                  onToggleEnabled={(enabled) => void setEnabled(skill.definition.id, enabled)}
                />
              ))
            : null}
        </div>
      </div>

      <div className="min-w-[440px] flex-1 bg-surface">
        {selectedSkill ? (
          <div className={`border-b border-border-subtle text-[12px] text-secondary ${skillsSectionBlockClassName}`}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-primary">
                    {selectedSkill.definition.name}
                  </div>
                  <div className="truncate text-[var(--font-size-label)] text-tertiary">{selectedSkill.definition.id}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    label={selectedSkill.source === 'extension' ? 'Extension' : 'User'}
                    variant={selectedSkill.source === 'extension' ? 'info' : 'muted'}
                    className={skillMetaBadgeClassName}
                  />
                  {selectedSkill.source === 'extension' ? (
                    <Badge label="Read-only" variant="muted" className={skillMetaBadgeClassName} />
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void setDefaultSkill(selectedIsDefault ? null : selectedSkill.definition.id)}
                  className={`${selectedIsDefault ? primaryActionButtonClassName : neutralActionButtonClassName} min-w-[112px]`}
                >
                  {selectedIsDefault ? 'Clear default' : 'Set default'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void setLastUsedSkill(selectedIsLastUsed ? null : selectedSkill.definition.id)
                  }
                  className={`${selectedIsLastUsed ? primaryActionButtonClassName : neutralActionButtonClassName} min-w-[124px]`}
                >
                  {selectedIsLastUsed ? 'Clear last used' : 'Mark last used'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <SkillEditor
          draft={editorDraft}
          isCreateMode={editorMode === 'create'}
          isSaving={isSaving}
          readOnly={editorMode !== 'create' && selectedSkill?.source === 'extension'}
          error={error}
          onDraftChange={setDraft}
          onSave={() => void handleSave()}
          onCancel={handleCancel}
          onDelete={selectedSkill?.source === 'user' ? () => void handleDelete() : undefined}
        />
      </div>
    </div>
  );
}
