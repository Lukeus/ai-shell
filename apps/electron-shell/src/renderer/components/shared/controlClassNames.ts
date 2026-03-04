const ACTION_BUTTON_BASE = `
  inline-flex items-center justify-center
  h-[var(--size-control-row)] rounded-none border
  px-[var(--vscode-space-3)]
  text-[var(--font-size-control)] leading-[var(--line-height-control)]
  focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focus-border)]
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export const secondaryActionButtonClassName = `
  ${ACTION_BUTTON_BASE}
  border-[var(--vscode-button-secondaryBackground)]
  bg-[var(--vscode-button-secondaryBackground)]
  text-[var(--vscode-button-secondaryForeground)]
  hover:bg-[var(--vscode-button-secondaryHoverBackground)]
`;

export const primaryActionButtonClassName = `
  ${ACTION_BUTTON_BASE}
  border-[var(--vscode-button-background)]
  bg-[var(--vscode-button-background)]
  text-[var(--vscode-button-foreground)]
  hover:bg-[var(--vscode-button-hoverBackground)]
`;

export const accentActionButtonClassName = `
  ${ACTION_BUTTON_BASE}
  border-accent bg-accent
  text-[var(--vscode-button-foreground)] font-semibold
  hover:bg-accent-hover
`;

export const neutralActionButtonClassName = `
  ${ACTION_BUTTON_BASE}
  border-border-subtle bg-surface
  text-primary
  hover:bg-surface-hover
`;

export const dangerActionButtonClassName = `
  ${ACTION_BUTTON_BASE}
  border-status-error bg-transparent
  text-status-error
  hover:bg-surface-hover
`;
