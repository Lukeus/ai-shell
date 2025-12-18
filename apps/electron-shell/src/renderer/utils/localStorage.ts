import { LayoutState, LayoutStateSchema } from 'packages-api-contracts';

/**
 * localStorage utility for LayoutState persistence.
 * 
 * Provides safe read/write operations with Zod validation and error handling.
 * Used by useLayoutState hook for persistent layout state management.
 */

/**
 * Reads layout state from localStorage with Zod validation.
 * 
 * @param key - localStorage key to read from
 * @returns Validated LayoutState object, or null if key doesn't exist or validation fails
 * 
 * @example
 * ```ts
 * const state = getLayoutState('ai-shell:layout-state:global');
 * if (state) {
 *   console.log('Loaded layout:', state);
 * }
 * ```
 */
export function getLayoutState(key: string): LayoutState | null {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    
    // Validate with Zod schema - throws if invalid
    const validated = LayoutStateSchema.parse(parsed);
    
    return validated;
  } catch (error) {
    // Log warning but don't throw - allows graceful fallback to defaults
    console.warn(`Failed to parse layout state from localStorage key "${key}":`, error);
    
    // Clear corrupted value
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors during cleanup
    }
    
    return null;
  }
}

/**
 * Writes layout state to localStorage with JSON serialization.
 * 
 * @param key - localStorage key to write to
 * @param state - LayoutState object to persist (must be valid per schema)
 * 
 * @example
 * ```ts
 * setLayoutState('ai-shell:layout-state:global', {
 *   ...currentState,
 *   primarySidebarWidth: 400
 * });
 * ```
 */
export function setLayoutState(key: string, state: LayoutState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(key, serialized);
  } catch (error) {
    // Handle QuotaExceededError and other storage errors
    console.error(`Failed to save layout state to localStorage key "${key}":`, error);
    
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Layout state not persisted.');
    }
  }
}
