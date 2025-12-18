import { createContext, useContext, useCallback, useEffect, ReactNode } from 'react';
import { LayoutState, LayoutStateSchema, DEFAULT_LAYOUT_STATE } from 'packages-api-contracts';
import { useLayoutState } from '../hooks/useLayoutState';

/**
 * Shape of the LayoutContext value.
 * Provides layout state and action functions for updating specific layout properties.
 */
interface LayoutContextValue {
  /** Current layout state */
  state: LayoutState;
  
  /** Update primary sidebar width (validated by Zod schema) */
  updatePrimarySidebarWidth: (width: number) => void;
  
  /** Update secondary sidebar width (validated by Zod schema) */
  updateSecondarySidebarWidth: (width: number) => void;
  
  /** Update bottom panel height (validated by Zod schema) */
  updateBottomPanelHeight: (height: number) => void;
  
  /** Toggle primary sidebar collapsed state */
  togglePrimarySidebar: () => void;
  
  /** Toggle secondary sidebar collapsed state */
  toggleSecondarySidebar: () => void;
  
  /** Toggle bottom panel collapsed state */
  toggleBottomPanel: () => void;
  
  /** Set active activity bar icon (validated by Zod enum) */
  setActiveActivityBarIcon: (icon: string) => void;
  
  /** Reset layout to default state and clear localStorage */
  resetLayout: () => void;
}

/**
 * React context for layout state management.
 * Context value includes layout state and action functions.
 * 
 * Uses browser-only localStorage API (P1: Process isolation).
 * Implements context splitting to prevent unnecessary re-renders (P5: Performance budgets).
 */
const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

/**
 * Props for LayoutProvider component.
 */
interface LayoutProviderProps {
  /** Child components */
  children: ReactNode;
}

/**
 * LayoutProvider component - Wraps the app with layout state management context.
 * 
 * Features:
 * - Manages layout state via useLayoutState hook (localStorage persistence)
 * - Provides action functions for updating layout properties with Zod validation
 * - Registers keyboard shortcuts (Ctrl+B, Ctrl+J, Ctrl+Shift+E)
 * - Prevents default browser behavior for registered shortcuts
 * 
 * Keyboard shortcuts:
 * - Ctrl+B (Cmd+B on Mac): Toggle primary sidebar
 * - Ctrl+J (Cmd+J on Mac): Toggle bottom panel
 * - Ctrl+Shift+E (Cmd+Shift+E on Mac): Set active icon to Explorer
 * - Ctrl+, (Cmd+, on Mac): Open settings
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <LayoutProvider>
 *       <ShellLayout />
 *     </LayoutProvider>
 *   );
 * }
 * ```
 */
export function LayoutProvider({ children }: LayoutProviderProps) {
  const [state, setState] = useLayoutState();

  /**
   * Update primary sidebar width with Zod validation.
   */
  const updatePrimarySidebarWidth = useCallback((width: number) => {
    try {
      const validated = LayoutStateSchema.parse({
        ...state,
        primarySidebarWidth: width,
      });
      setState(validated);
    } catch (error) {
      console.warn('Invalid primary sidebar width:', width, error);
    }
  }, [state, setState]);

  /**
   * Update secondary sidebar width with Zod validation.
   */
  const updateSecondarySidebarWidth = useCallback((width: number) => {
    try {
      const validated = LayoutStateSchema.parse({
        ...state,
        secondarySidebarWidth: width,
      });
      setState(validated);
    } catch (error) {
      console.warn('Invalid secondary sidebar width:', width, error);
    }
  }, [state, setState]);

  /**
   * Update bottom panel height with Zod validation.
   */
  const updateBottomPanelHeight = useCallback((height: number) => {
    try {
      const validated = LayoutStateSchema.parse({
        ...state,
        bottomPanelHeight: height,
      });
      setState(validated);
    } catch (error) {
      console.warn('Invalid bottom panel height:', height, error);
    }
  }, [state, setState]);

  /**
   * Toggle primary sidebar collapsed state.
   */
  const togglePrimarySidebar = useCallback(() => {
    setState({
      ...state,
      primarySidebarCollapsed: !state.primarySidebarCollapsed,
    });
  }, [state, setState]);

  /**
   * Toggle secondary sidebar collapsed state.
   */
  const toggleSecondarySidebar = useCallback(() => {
    setState({
      ...state,
      secondarySidebarCollapsed: !state.secondarySidebarCollapsed,
    });
  }, [state, setState]);

  /**
   * Toggle bottom panel collapsed state.
   */
  const toggleBottomPanel = useCallback(() => {
    setState({
      ...state,
      bottomPanelCollapsed: !state.bottomPanelCollapsed,
    });
  }, [state, setState]);

  /**
   * Set active activity bar icon with Zod validation.
   */
  const setActiveActivityBarIcon = useCallback((icon: string) => {
    try {
      const validated = LayoutStateSchema.parse({
        ...state,
        activeActivityBarIcon: icon,
      });
      setState(validated);
    } catch (error) {
      console.warn('Invalid activity bar icon:', icon, error);
    }
  }, [state, setState]);

  /**
   * Reset layout to default state and clear localStorage.
   */
  const resetLayout = useCallback(() => {
    localStorage.removeItem('ai-shell:layout-state:global');
    setState(DEFAULT_LAYOUT_STATE);
  }, [setState]);

  /**
   * Register keyboard shortcuts for layout actions.
   * Uses browser keyboard events (P1: Process isolation).
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl or Cmd (Mac)
      const modifier = e.ctrlKey || e.metaKey;

      if (modifier && e.key === 'b' && !e.shiftKey) {
        // Ctrl+B / Cmd+B: Toggle primary sidebar
        e.preventDefault();
        togglePrimarySidebar();
      } else if (modifier && e.key === 'j' && !e.shiftKey) {
        // Ctrl+J / Cmd+J: Toggle bottom panel
        e.preventDefault();
        toggleBottomPanel();
      } else if (modifier && e.shiftKey && e.key === 'E') {
        // Ctrl+Shift+E / Cmd+Shift+E: Focus Explorer
        e.preventDefault();
        setActiveActivityBarIcon('explorer');
      } else if (modifier && e.key === ',' && !e.shiftKey) {
        // Ctrl+, / Cmd+,: Open Settings
        e.preventDefault();
        setActiveActivityBarIcon('settings');
      }
    };

    // Register global keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePrimarySidebar, toggleBottomPanel, setActiveActivityBarIcon]);

  const value: LayoutContextValue = {
    state,
    updatePrimarySidebarWidth,
    updateSecondarySidebarWidth,
    updateBottomPanelHeight,
    togglePrimarySidebar,
    toggleSecondarySidebar,
    toggleBottomPanel,
    setActiveActivityBarIcon,
    resetLayout,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

/**
 * Custom hook to access LayoutContext.
 * 
 * @throws Error if used outside LayoutProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, togglePrimarySidebar } = useLayoutContext();
 *   return <button onClick={togglePrimarySidebar}>Toggle</button>;
 * }
 * ```
 */
export function useLayoutContext(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within LayoutProvider');
  }
  return context;
}
