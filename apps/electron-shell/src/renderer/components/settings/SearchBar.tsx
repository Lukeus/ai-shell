import React from 'react';

/**
 * Props for the SearchBar component.
 */
export interface SearchBarProps {
  /** Current search query */
  value: string;
  
  /** Callback when search query changes */
  onChange: (query: string) => void;
  
  /** Optional placeholder text */
  placeholder?: string;
}

/**
 * SearchBar component - Input field for filtering settings.
 * 
 * Features:
 * - Filters settings by label/description/key (case-insensitive substring match)
 * - Real-time search with onChange callback
 * - Styled with CSS variables
 * 
 * P1 (Process isolation): Renderer-only component with no Node.js/Electron dependencies
 * P4 (UI design system): Uses Tailwind 4 CSS variable tokens
 * 
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onChange={(query) => setSearchQuery(query)}
 *   placeholder="Search settings..."
 * />
 * ```
 */
export function SearchBar({ value, onChange, placeholder = 'Search settings...' }: SearchBarProps) {
  // eslint-disable-next-line no-undef
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="w-full">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full h-[var(--size-control-row)] rounded-none
          bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]
          px-[var(--vscode-space-3)]
          text-primary text-[var(--font-size-control)] leading-[var(--line-height-control)]
          placeholder:text-tertiary
          focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent
          transition-colors duration-150
        "
      />
    </div>
  );
}
