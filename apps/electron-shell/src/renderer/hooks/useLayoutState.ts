import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutState, DEFAULT_LAYOUT_STATE } from 'packages-api-contracts';
import { getLayoutState, setLayoutState } from '../utils/localStorage';

/**
 * localStorage key for global layout state persistence.
 */
const LAYOUT_STATE_KEY = 'ai-shell:layout-state:global';

/**
 * Debounce delay in milliseconds for localStorage writes.
 * Prevents excessive writes during rapid state changes (e.g., dragging resize handles).
 */
const DEBOUNCE_DELAY_MS = 200;

/**
 * Custom React hook for persistent layout state management.
 * 
 * Features:
 * - Reads initial state from localStorage on mount with Zod validation
 * - Falls back to DEFAULT_LAYOUT_STATE if localStorage is empty or invalid
 * - Debounces localStorage writes by 200ms to optimize performance during drag operations
 * - Handles storage errors gracefully (QuotaExceededError, parse errors)
 * 
 * Uses browser-only localStorage API (P1: Process isolation).
 * Stores only UI dimensions and boolean flags (P2: Security defaults - no secrets).
 * 
 * @returns Tuple of [state, setState] similar to useState
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [layoutState, setLayoutState] = useLayoutState();
 *   
 *   const handleResize = (newWidth: number) => {
 *     setLayoutState({ ...layoutState, primarySidebarWidth: newWidth });
 *   };
 *   
 *   return <div style={{ width: layoutState.primarySidebarWidth }}>...</div>;
 * }
 * ```
 */
export function useLayoutState(): [LayoutState, (state: LayoutState) => void] {
  // Initialize state from localStorage or defaults
  const [state, setState] = useState<LayoutState>(() => {
    const stored = getLayoutState(LAYOUT_STATE_KEY);
    return stored ?? DEFAULT_LAYOUT_STATE;
  });

  // Ref to store the debounce timer ID
  const debounceTimerRef = useRef<number | null>(null);

  /**
   * Update state and persist to localStorage (debounced).
   */
  const setStateWithPersistence = useCallback((newState: LayoutState) => {
    // Update React state immediately for responsive UI
    setState(newState);

    // Clear existing debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule debounced localStorage write
    debounceTimerRef.current = window.setTimeout(() => {
      setLayoutState(LAYOUT_STATE_KEY, newState);
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY_MS);
  }, []);

  // Cleanup: flush pending writes on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        // Flush final state immediately on unmount
        setLayoutState(LAYOUT_STATE_KEY, state);
      }
    };
  }, [state]);

  return [state, setStateWithPersistence];
}
