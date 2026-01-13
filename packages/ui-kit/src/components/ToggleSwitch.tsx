
import { Switch, Label, Field } from '@headlessui/react';

/**
 * Props for the ToggleSwitch component.
 */
export interface ToggleSwitchProps {
  /** Whether the switch is currently checked */
  checked: boolean;
  
  /** Callback when the switch state changes */
  onChange: (checked: boolean) => void;
  
  /** Optional label text displayed next to the switch */
  label?: string;
  
  /** Whether the switch is disabled */
  disabled?: boolean;
}

/**
 * ToggleSwitch component - Accessible toggle switch for boolean settings.
 * 
 * Features:
 * - ARIA roles for accessibility (role="switch", aria-checked)
 * - Keyboard support (Space/Enter to toggle)
 * - Styled with CSS variables: bg-accent when checked, bg-surface-secondary when unchecked
 * - Visual feedback for hover, focus, and disabled states
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <ToggleSwitch
 *   checked={enabled}
 *   onChange={(checked) => setEnabled(checked)}
 *   label="Enable feature"
 * />
 * ```
 */
export function ToggleSwitch({ checked, onChange, label, disabled = false }: ToggleSwitchProps) {
  const switchClassName = `
    relative inline-flex h-6 w-11 items-center rounded-full
    transition-colors duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface
    ${checked ? 'bg-accent' : 'bg-surface-secondary'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;
  const thumbClassName = `
    inline-block h-4 w-4 transform rounded-full bg-control-foreground
    transition-transform duration-200 ease-in-out
    ${checked ? 'translate-x-6' : 'translate-x-1'}
  `;

  return (
    <Field as="div" className="flex items-center gap-3">
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={switchClassName}
        aria-label={label ? undefined : 'Toggle switch'}
      >
        <span aria-hidden="true" className={thumbClassName} />
      </Switch>
      
      {/* Optional label */}
      {label && (
        <Label
          className={`
            text-sm text-primary select-none
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {label}
        </Label>
      )}
    </Field>
  );
}
