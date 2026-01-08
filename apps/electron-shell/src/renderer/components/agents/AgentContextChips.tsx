import type { AgentContextAttachment, AgentTextRange } from 'packages-api-contracts';

type AgentContextChipsProps = {
  attachments: AgentContextAttachment[];
  onRemove?: (index: number) => void;
};

const formatRange = (range?: AgentTextRange): string => {
  if (!range) {
    return '';
  }
  return `L${range.startLineNumber}:${range.startColumn}-L${range.endLineNumber}:${range.endColumn}`;
};

const formatAttachmentLabel = (attachment: AgentContextAttachment): string => {
  const parts = attachment.filePath.split(/[\\/]/).filter(Boolean);
  const fileName = parts.length > 0 ? parts[parts.length - 1] : attachment.filePath;
  const rangeLabel = formatRange(attachment.range);
  const suffix = rangeLabel ? ` (${rangeLabel})` : '';
  return `${fileName}${suffix}`;
};

export function AgentContextChips({ attachments, onRemove }: AgentContextChipsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment, index) => {
        const label = formatAttachmentLabel(attachment);
        return (
          <div
            key={`${attachment.kind}-${attachment.filePath}-${index}`}
            className="
              inline-flex items-center gap-2 rounded-none
              border border-border-subtle bg-surface px-2 py-1
              text-[11px] text-secondary
            "
          >
            <span className="uppercase tracking-wide text-tertiary">
              {attachment.kind}
            </span>
            <span className="text-primary">{label}</span>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-tertiary hover:text-primary"
                aria-label="Remove attachment"
              >
                <span className="codicon codicon-close" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
