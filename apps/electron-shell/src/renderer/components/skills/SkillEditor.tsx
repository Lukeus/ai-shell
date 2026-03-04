import type { ChangeEvent } from 'react';
import {
  accentActionButtonClassName,
  dangerActionButtonClassName,
  neutralActionButtonClassName,
} from '../shared/controlClassNames';

export type SkillEditorDraft = {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  toolAllowlist: string;
  toolDenylist: string;
  tags: string;
};

type SkillEditorProps = {
  draft: SkillEditorDraft;
  isCreateMode: boolean;
  isSaving: boolean;
  readOnly: boolean;
  error: string | null;
  onDraftChange: (draft: SkillEditorDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
};

const fieldLabelClassName =
  'mb-1.5 block text-[var(--font-size-label)] uppercase tracking-[0.08em] text-secondary';
const editorInsetClassName = 'pl-[var(--vscode-space-4)] pr-[var(--vscode-space-6)]';

const updateDraftField = (
  draft: SkillEditorDraft,
  key: keyof SkillEditorDraft,
  value: string,
  onDraftChange: (nextDraft: SkillEditorDraft) => void
): void => {
  onDraftChange({
    ...draft,
    [key]: value,
  });
};

const renderInput = (
  id: string,
  value: string,
  disabled: boolean,
  // eslint-disable-next-line no-undef
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
  placeholder?: string
) => (
  <input
    id={id}
    type="text"
    value={value}
    disabled={disabled}
    onChange={onChange}
    placeholder={placeholder}
    className="
      w-full h-[var(--size-list-row)] rounded-none
      border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)]
      pl-[var(--vscode-space-3)] pr-[var(--vscode-space-5)]
      text-[13px] text-primary leading-[var(--vscode-line-height-compact)]
      placeholder:text-tertiary
      focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent
      disabled:opacity-60
    "
  />
);

const renderTextArea = (
  id: string,
  value: string,
  disabled: boolean,
  rows: number,
  // eslint-disable-next-line no-undef
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void,
  placeholder?: string
) => (
  <textarea
    id={id}
    value={value}
    disabled={disabled}
    rows={rows}
    onChange={onChange}
    placeholder={placeholder}
    className="
      w-full resize-y rounded-none
      border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)]
      pl-[var(--vscode-space-3)] pr-[var(--vscode-space-5)] py-[var(--vscode-space-2)]
      text-[13px] text-primary leading-[1.4]
      placeholder:text-tertiary
      focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent
      disabled:opacity-60
    "
  />
);

export function SkillEditor({
  draft,
  isCreateMode,
  isSaving,
  readOnly,
  error,
  onDraftChange,
  onSave,
  onCancel,
  onDelete,
}: SkillEditorProps) {
  const isSaveDisabled =
    isSaving || readOnly || draft.id.trim().length === 0 || draft.name.trim().length === 0;

  return (
    <div className={`h-full overflow-auto py-[var(--vscode-space-4)] ${editorInsetClassName}`}>
      <div className="mb-4 text-[12px] uppercase tracking-[0.08em] text-secondary">
        {isCreateMode ? 'Create Skill' : 'Edit Skill'}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="skill-editor-id" className={fieldLabelClassName}>
            Skill ID
          </label>
          {renderInput(
            'skill-editor-id',
            draft.id,
            readOnly || !isCreateMode,
            (event) => updateDraftField(draft, 'id', event.target.value, onDraftChange),
            'example.skill-id'
          )}
        </div>

        <div>
          <label htmlFor="skill-editor-name" className={fieldLabelClassName}>
            Name
          </label>
          {renderInput(
            'skill-editor-name',
            draft.name,
            readOnly,
            (event) => updateDraftField(draft, 'name', event.target.value, onDraftChange)
          )}
        </div>

        <div>
          <label htmlFor="skill-editor-description" className={fieldLabelClassName}>
            Description
          </label>
          {renderTextArea(
            'skill-editor-description',
            draft.description,
            readOnly,
            2,
            (event) => updateDraftField(draft, 'description', event.target.value, onDraftChange)
          )}
        </div>

        <div>
          <label htmlFor="skill-editor-prompt" className={fieldLabelClassName}>
            Prompt Template
          </label>
          {renderTextArea(
            'skill-editor-prompt',
            draft.promptTemplate,
            readOnly,
            5,
            (event) => updateDraftField(draft, 'promptTemplate', event.target.value, onDraftChange),
            'Prepended to the run goal before execution.'
          )}
        </div>

        <div>
          <label htmlFor="skill-editor-allowlist" className={fieldLabelClassName}>
            Tool Allowlist (comma separated)
          </label>
          {renderInput(
            'skill-editor-allowlist',
            draft.toolAllowlist,
            readOnly,
            (event) => updateDraftField(draft, 'toolAllowlist', event.target.value, onDraftChange)
          )}
        </div>

        <div>
          <label htmlFor="skill-editor-denylist" className={fieldLabelClassName}>
            Tool Denylist (comma separated)
          </label>
          {renderInput(
            'skill-editor-denylist',
            draft.toolDenylist,
            readOnly,
            (event) => updateDraftField(draft, 'toolDenylist', event.target.value, onDraftChange)
          )}
        </div>

        <div>
          <label htmlFor="skill-editor-tags" className={fieldLabelClassName}>
            Tags (comma separated)
          </label>
          {renderInput(
            'skill-editor-tags',
            draft.tags,
            readOnly,
            (event) => updateDraftField(draft, 'tags', event.target.value, onDraftChange)
          )}
        </div>
      </div>

      {error ? <div className="mt-4 text-[12px] text-error">{error}</div> : null}

      <div className="mt-6 flex items-center gap-2 border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaveDisabled}
          className={`${accentActionButtonClassName} min-w-[88px]`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className={`${neutralActionButtonClassName} min-w-[88px]`}
        >
          Cancel
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving || readOnly}
            className={`ml-auto min-w-[88px] ${dangerActionButtonClassName}`}
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
