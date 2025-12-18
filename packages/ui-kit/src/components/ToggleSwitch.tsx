import React, { useCallback } from 'react';

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
  /**
   * Handle toggle via keyboard (Space/Enter)
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  }, [checked, disabled, onChange]);

  /**
   * Handle toggle via mouse click
   */
  const handleClick = useCallback(() => {
    if (disabled) return;
    onChange(!checked);
  }, [checked, disabled, onChange]);

  return (
    <div className="flex items-center gap-3">
      {/* Toggle switch button */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || 'Toggle switch'}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface
          ${checked ? 'bg-accent' : 'bg-surface-secondary'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Toggle indicator (circle that slides) */}
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-primary
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      
      {/* Optional label */}
      {label && (
        <label
          onClick={disabled ? undefined : handleClick}
          className={`
            text-sm text-primary select-none
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {label}
        </label>
      )}
    </div>
  );
}
