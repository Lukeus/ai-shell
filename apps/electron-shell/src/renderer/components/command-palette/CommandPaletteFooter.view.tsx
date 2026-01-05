interface CommandPaletteFooterProps {
  actionError: string | null;
  isCommandMode: boolean;
}

export function CommandPaletteFooter({ actionError, isCommandMode }: CommandPaletteFooterProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-4">
        {actionError && <span className="text-status-error">{actionError}</span>}
        {!actionError && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="rounded-xs bg-surface-hover px-1.5 py-0.5 border border-border-subtle font-medium text-[10px]"></span>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-xs bg-surface-hover px-1.5 py-0.5 border border-border-subtle font-medium text-[10px]">?</span>
              <span>to select</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-xs bg-surface-hover px-1.5 py-0.5 border border-border-subtle font-medium text-[10px]">esc</span>
              <span>to dismiss</span>
            </div>
          </>
        )}
      </div>
      <div className="text-[10px] opacity-50">
        {isCommandMode ? 'Command Mode' : 'File Search'}
      </div>
    </div>
  );
}
