import React from 'react';

/**
 * Setting category definition.
 */
export interface SettingsCategory {
  /** Unique category ID */
  id: string;
  
  /** Display label for category */
  label: string;
}

/**
 * Props for the SettingsCategoryNav component.
 */
export interface SettingsCategoryNavProps {
  /** Available categories */
  categories: SettingsCategory[];
  
  /** Currently active category ID */
  activeCategory: string;
  
  /** Callback when category is clicked */
  onCategoryClick: (categoryId: string) => void;
}

/**
 * SettingsCategoryNav component - Sidebar navigation for settings categories.
 * 
 * Features:
 * - Renders list of categories with active state highlighting
 * - Click handler updates active category and clears search
 * - Styled with CSS variables
 * 
 * P1 (Process isolation): Renderer-only component with no Node.js/Electron dependencies
 * P4 (UI design system): Uses Tailwind 4 CSS variable tokens
 * 
 * @example
 * ```tsx
 * <SettingsCategoryNav
 *   categories={[
 *     { id: 'appearance', label: 'Appearance' },
 *     { id: 'editor', label: 'Editor' },
 *   ]}
 *   activeCategory="appearance"
 *   onCategoryClick={(id) => setActiveCategory(id)}
 * />
 * ```
 */
export function SettingsCategoryNav({
  categories,
  activeCategory,
  onCategoryClick,
}: SettingsCategoryNavProps) {
  return (
    <nav className="w-full">
      <ul className="space-y-0">
        {categories.map((category) => {
          const isActive = category.id === activeCategory;
          
          return (
            <li key={category.id}>
              <button
                onClick={() => onCategoryClick(category.id)}
                className={`
                  w-full flex items-center text-left
                  font-medium
                  transition-colors duration-150
                  px-[var(--vscode-space-3)] pr-[var(--vscode-space-2)]
                  ${isActive
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-primary'
                    : 'text-secondary hover:bg-surface-hover hover:text-primary'
                  }
                `}
                style={{
                  height: 'var(--size-list-row)',
                  fontSize: 'var(--vscode-font-size-ui)',
                }}
              >
                <span className="block truncate">{category.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
