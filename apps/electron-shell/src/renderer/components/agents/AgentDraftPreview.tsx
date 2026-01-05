import { useEffect, useMemo, useState } from 'react';
import { TabBar } from 'packages-ui-kit';
import type { AgentDraft } from 'packages-api-contracts';

type AgentDraftPreviewProps = {
  draft: AgentDraft;
  saved: boolean;
  sddEnabled: boolean;
  isSaving: boolean;
  onSave: (allowOverwrite: boolean) => Promise<void>;
  onRunSdd: (goal: string) => Promise<void>;
};

type DraftSection = 'spec' | 'plan' | 'tasks';

export function AgentDraftPreview({
  draft,
  saved,
  sddEnabled,
  isSaving,
  onSave,
  onRunSdd,
}: AgentDraftPreviewProps) {
  const [activeSection, setActiveSection] = useState<DraftSection>('spec');
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [sddGoal, setSddGoal] = useState(`Execute ${draft.featureId}`);
  const canRunSdd = sddGoal.trim().length > 0;

  useEffect(() => {
    setSddGoal(`Execute ${draft.featureId}`);
  }, [draft.featureId]);

  const content = useMemo(() => {
    if (activeSection === 'plan') {
      return draft.plan;
    }
    if (activeSection === 'tasks') {
      return draft.tasks;
    }
    return draft.spec;
  }, [activeSection, draft.plan, draft.spec, draft.tasks]);

  const tabs = [
    { id: 'spec', label: 'spec.md' },
    { id: 'plan', label: 'plan.md' },
    { id: 'tasks', label: 'tasks.md' },
  ];

  return (
    <div className="border-t border-border-subtle bg-surface-secondary">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-[11px] uppercase tracking-wide text-secondary">
          Draft preview
        </div>
        <div className="text-[10px] uppercase tracking-wide text-secondary">
          {saved ? 'Saved' : 'Draft'}
        </div>
      </div>
      <TabBar
        tabs={tabs}
        activeTabId={activeSection}
        onChange={(tabId) => setActiveSection(tabId as DraftSection)}
      />
      <div className="px-4 py-3">
        <pre className="whitespace-pre-wrap text-[12px] text-primary leading-relaxed">
          {content}
        </pre>
        <div className="mt-3 flex items-center gap-3 text-[12px] text-secondary">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowOverwrite}
              onChange={(event) => setAllowOverwrite(event.target.checked)}
              className="accent-[var(--vscode-textLink-foreground)]"
            />
            Allow overwrite
          </label>
          <span>Feature: {draft.featureId}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave(allowOverwrite)}
            disabled={isSaving}
            className="
              rounded-none uppercase tracking-wide
              bg-accent text-[var(--vscode-button-foreground)]
              disabled:opacity-60
            "
            style={{
              paddingLeft: 'var(--vscode-space-3)',
              paddingRight: 'var(--vscode-space-3)',
              paddingTop: 'var(--vscode-space-1)',
              paddingBottom: 'var(--vscode-space-1)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            Save draft
          </button>
        </div>
        {sddEnabled ? (
          <div className="mt-3 border border-border-subtle bg-surface px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-secondary">
              Run SDD
            </div>
            <input
              type="text"
              value={sddGoal}
              onChange={(event) => setSddGoal(event.target.value)}
              placeholder="SDD goal..."
              className="
                w-full rounded-none mt-2
                bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-primary
                placeholder:text-tertiary
                focus:outline-none focus:ring-1 focus:ring-accent
              "
              style={{
                height: 'var(--vscode-list-rowHeight)',
                paddingLeft: 'var(--vscode-space-2)',
                paddingRight: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-ui)',
              }}
            />
            <button
              type="button"
              onClick={() => onRunSdd(sddGoal)}
              disabled={!canRunSdd}
              className="
                mt-2 rounded-none uppercase tracking-wide
                border border-border-subtle text-secondary
                hover:text-primary hover:border-border
                disabled:opacity-60
              "
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-1)',
                paddingBottom: 'var(--vscode-space-1)',
                fontSize: 'var(--vscode-font-size-small)',
              }}
            >
              Run SDD
            </button>
          </div>
        ) : (
          <div className="mt-3 border border-border-subtle bg-surface px-3 py-2 text-[12px] text-secondary">
            SDD is disabled. Save the draft now and run SDD when it is enabled.
          </div>
        )}
      </div>
    </div>
  );
}
