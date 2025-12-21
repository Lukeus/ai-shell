import React from 'react';

/**
 * Option definition for Select component.
 */
export interface SelectOption {
  /** Unique value for this option */
  value: string;
  
  /** Display label for this option */
  label: string;
}

/**
 * Props for the Select component.
 */
export interface SelectProps {
  /** Currently selected value */
  value: string;
  
  /** Callback when selection changes */
  onChange: (value: string) => void;
  
  /** Array of options to display */
  options: SelectOption[];
  
  /** Whether the select is disabled */
  disabled?: boolean;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * Select component - Native select dropdown with custom styling.
 * 
 * Features:
 * - Native <select> element for best keyboard navigation support
 * - Custom styling with CSS variables
 * - Accessible with proper ARIA attributes
 * - Styled with CSS variables: border-border, bg-surface, text-primary
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <Select
 *   value={theme}
 *   onChange={(value) => setTheme(value)}
 *   options={[
 *     { value: 'dark', label: 'Dark' },
 *     { value: 'light', label: 'Light' },
 *   ]}
 * />
 * ```
 */
export function Select({ value, onChange, options, disabled = false, className = '' }: SelectProps) {
  /**
   * Handle selection change
   */
  // eslint-disable-next-line no-undef
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={`
        px-2 py-1.5 rounded-none
        bg-surface border border-border
        text-primary text-[13px]
        focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
        transition-colors duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-accent/50'}
        ${className}
      `}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
