type AgentStreamingIndicatorProps = {
  status?: { phase: string; label: string } | null;
  className?: string;
};

const titleCase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const formatStatusLabel = (status: AgentStreamingIndicatorProps['status']) => {
  if (!status) {
    return 'Working';
  }
  const phase = titleCase(status.phase);
  const label = status.label.trim();
  if (!label || label.toLowerCase() === status.phase.toLowerCase()) {
    return phase || 'Working';
  }
  return `${phase || 'Working'} - ${label}`;
};

export function AgentStreamingIndicator({ status, className }: AgentStreamingIndicatorProps) {
  const label = formatStatusLabel(status);

  return (
    <div
      className={`flex items-center gap-2 text-[11px] tracking-wide text-secondary ${className ?? ''}`}
      aria-live="polite"
    >
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '120ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '240ms' }} />
      </span>
      <span>{label}</span>
    </div>
  );
}
