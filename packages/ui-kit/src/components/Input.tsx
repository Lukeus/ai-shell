import React, { useCallback, useMemo } from 'react';

/**
 * Props for the Input component.
 */
export interface InputProps {
  /** Input type */
  type: 'text' | 'number';
  
  /** Current value */
  value: string | number;
  
  /** Callback when value changes */
  onChange: (value: string | number) => void;
  
  /** Minimum value (number inputs only) */
  min?: number;
  
  /** Maximum value (number inputs only) */
  max?: number;
  
  /** Whether the input is disabled */
  disabled?: boolean;
  
  /** Optional placeholder text */
  placeholder?: string;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * Input component - Text and number input with validation.
 * 
 * Features:
 * - Supports text and number input types
 * - Validation states (error border if value out of range for number inputs)
 * - Styled with CSS variables: border-border, bg-surface, text-primary
 * - Accessible with proper ARIA attributes
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <Input
 *   type="number"
 *   value={fontSize}
 *   onChange={(value) => setFontSize(Number(value))}
 *   min={10}
 *   max={24}
 * />
 * ```
 */
export function Input({
  type,
  value,
  onChange,
  min,
  max,
  disabled = false,
  placeholder,
  className = '',
}: InputProps) {
  /**
   * Check if current value is out of range (for number inputs)
   */
  const isOutOfRange = useMemo(() => {
    if (type !== 'number') return false;
    const numValue = typeof value === 'number' ? value : parseFloat(value as string);
    if (isNaN(numValue)) return false;
    
    if (min !== undefined && numValue < min) return true;
    if (max !== undefined && numValue > max) return true;
    
    return false;
  }, [type, value, min, max]);

  /**
   * Handle input change
   */
  // eslint-disable-next-line no-undef
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    if (type === 'number') {
      // For number inputs, parse and validate
      const numValue = parseFloat(newValue);
      
      // Allow empty string for clearing
      if (newValue === '') {
        onChange('');
        return;
      }
      
      // Only update if it's a valid number
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    } else {
      // For text inputs, pass value as-is
      onChange(newValue);
    }
  }, [type, onChange]);

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`
        px-3 py-2 rounded-md
        bg-surface text-primary text-sm
        focus:outline-none focus:ring-2 focus:ring-accent
        transition-colors duration-200
        ${isOutOfRange 
          ? 'border-2 border-status-error focus:border-status-error' 
          : 'border border-border focus:border-accent'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent/50'}
        ${className}
      `}
      aria-invalid={isOutOfRange}
      aria-describedby={isOutOfRange ? 'input-error' : undefined}
    />
  );
}
