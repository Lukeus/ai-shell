import React from 'react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

/**
 * Option definition for Select component.
 */
export interface SelectOption {
  /** Unique value for this option */
  value: string;
  
  /** Display label for this option */
  label: string;

  /** Whether this option is disabled */
  disabled?: boolean;
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

  /** Render variant (native select or listbox) */
  variant?: 'native' | 'listbox';
  
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
export function Select({
  value,
  onChange,
  options,
  variant = 'native',
  disabled = false,
  className = '',
}: SelectProps) {
  const selectedOption = options.find((option) => option.value === value);
  const commonControlClasses = `
    px-2 py-1.5 rounded-none
    bg-surface border border-border
    text-primary text-[13px]
    focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
    transition-colors duration-200
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-accent/50'}
  `;

  if (variant === 'listbox') {
    return (
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className={`relative ${className}`}>
          <ListboxButton
            className={`inline-flex w-full items-center justify-between gap-2 ${commonControlClasses}`}
          >
            <span className="truncate text-left">
              {selectedOption?.label ?? ''}
            </span>
            <ChevronUpDownIcon className="h-4 w-4 text-secondary" aria-hidden="true" />
          </ListboxButton>
          <ListboxOptions
            className="
              absolute left-0 right-0 mt-1 max-h-60 overflow-auto
              rounded-none border border-border bg-surface text-[13px]
            "
            style={{
              zIndex: 'var(--vscode-z-dropdown)',
              boxShadow: 'var(--vscode-widget-shadow)',
            }}
          >
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={({ active, selected, disabled: optionDisabled }) => `
                  flex w-full items-center justify-between gap-2 px-2 py-1.5
                  ${optionDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${active ? 'bg-surface-hover text-primary' : 'text-primary'}
                  ${selected ? 'font-semibold' : 'font-normal'}
                `}
              >
                <span className="truncate">{option.label}</span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    );
  }

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
        ${commonControlClasses}
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
