import React from 'react';
import { ToggleSwitch, Select, Input, type SelectOption } from 'packages-ui-kit';

/**
 * Setting item type.
 */
export type SettingType = 'boolean' | 'enum' | 'string' | 'number';

/**
 * Props for the SettingItem component.
 */
export interface SettingItemProps {
  /** Setting label */
  label: string;
  
  /** Setting description */
  description: string;
  
  /** Current value */
  value: string | number | boolean;
  
  /** Type of setting */
  type: SettingType;
  
  /** Options for enum type */
  options?: SelectOption[];
  
  /** Callback when value changes */
  onChange: (value: string | number | boolean) => void;
  
  /** Min value for number type */
  min?: number;
  
  /** Max value for number type */
  max?: number;
}

/**
 * SettingItem component - Individual setting with appropriate control.
 * 
 * Features:
 * - Renders appropriate control based on type:
 *   - ToggleSwitch for boolean
 *   - Select for enum
 *   - Input for string/number
 * - Description in muted text below label
 * - Styled with CSS variables
 * 
 * P1 (Process isolation): Uses window.api.* for settings updates (via parent)
 * P4 (UI design system): Uses Tailwind 4 CSS variable tokens
 * 
 * @example
 * ```tsx
 * <SettingItem
 *   label="Theme"
 *   description="Choose your color theme"
 *   value="dark"
 *   type="enum"
 *   options={[
 *     { value: 'dark', label: 'Dark' },
 *     { value: 'light', label: 'Light' },
 *   ]}
 *   onChange={(value) => handleChange('theme', value)}
 * />
 * ```
 */
export function SettingItem({
  label,
  description,
  value,
  type,
  options = [],
  onChange,
  min,
  max,
}: SettingItemProps) {
  /**
   * Render appropriate control based on setting type
   */
  const renderControl = () => {
    switch (type) {
      case 'boolean':
        return (
          <ToggleSwitch
            checked={Boolean(value)}
            onChange={(checked) => onChange(checked)}
          />
        );
      
      case 'enum':
        if (options.length === 0) {
          console.warn(`SettingItem: No options provided for enum setting "${label}"`);
          return null;
        }
        return (
          <Select
            value={String(value)}
            onChange={(newValue) => onChange(newValue)}
            options={options}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value as string | number}
            onChange={(newValue) => onChange(newValue)}
            min={min}
            max={max}
          />
        );
      
      case 'string':
        return (
          <Input
            type="text"
            value={value as string | number}
            onChange={(newValue) => onChange(newValue)}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-3 border-b border-border-subtle last:border-b-0">
      <div className="flex items-start justify-between gap-6">
        {/* Label and description */}
        <div className="flex-1 min-w-0">
          <label className="block text-[13px] font-medium text-primary mb-1">
            {label}
          </label>
          <p className="text-xs text-secondary leading-snug">
            {description}
          </p>
        </div>
        
        {/* Control */}
        <div className="flex-shrink-0 min-w-[160px] flex justify-end">
          {renderControl()}
        </div>
      </div>
    </div>
  );
}
