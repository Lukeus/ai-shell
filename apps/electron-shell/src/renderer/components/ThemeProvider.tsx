import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Theme } from 'packages-api-contracts';

/**
 * ThemeProvider context value.
 * 
 * @remarks
 * - theme: User-selected theme from settings (may be 'system')
 * - effectiveTheme: Resolved theme ('dark' or 'light') actually applied to UI
 * - setTheme: Updates theme in settings and applies to <html> element
 * 
 * P1 (Process isolation): Uses only renderer APIs (window.api, window.matchMedia)
 * P2 (Security defaults): No direct IPC access; uses window.api.* only
 */
interface ThemeContextValue {
  /** User-selected theme (may be 'system') */
  theme: Theme;
  
  /** Effective theme applied to UI ('dark' or 'light') */
  effectiveTheme: 'dark' | 'light';
  
  /** Update theme in settings and apply to UI */
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Hook to access theme context.
 * 
 * @throws Error if used outside ThemeProvider
 * @returns ThemeContextValue with current theme and setTheme function
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, effectiveTheme, setTheme } = useTheme();
 *   return (
 *     <button onClick={() => setTheme('light')}>
 *       Current: {effectiveTheme}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * Resolves 'system' theme to 'dark' or 'light' based on OS preference.
 * 
 * @param theme - User-selected theme
 * @returns Effective theme ('dark' or 'light')
 * 
 * @remarks
 * Uses window.matchMedia('(prefers-color-scheme: dark)') to detect OS preference.
 * Falls back to 'dark' if matchMedia is unavailable (with console warning).
 */
function resolveEffectiveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    // Detect OS theme preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
      } catch (error) {
        console.warn('Failed to detect OS theme preference, falling back to dark:', error);
        return 'dark';
      }
    } else {
      console.warn('window.matchMedia not available, falling back to dark theme');
      return 'dark';
    }
  }
  
  // Non-system themes: map high-contrast variants to base themes
  if (theme === 'high-contrast-dark') {
    return 'dark';
  }
  if (theme === 'high-contrast-light') {
    return 'light';
  }
  
  return theme; // 'dark' or 'light'
}

/**
 * ThemeProvider component.
 * 
 * Fetches settings, sets data-theme attribute on <html>, and listens to OS theme changes.
 * 
 * @remarks
 * - Fetches settings via window.api.getSettings() on mount
 * - Sets data-theme attribute on <html> element (e.g., 'dark', 'light', 'high-contrast-dark')
 * - Resolves 'system' theme to 'dark' or 'light' for effectiveTheme
 * - Listens to OS theme changes via matchMedia when theme is 'system'
 * - Uses requestAnimationFrame for theme changes to optimize repaints (P5)
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <MyApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  /**
   * Apply theme to <html> element's data-theme attribute.
   * Uses requestAnimationFrame to batch DOM changes for optimal repaint performance (P5).
   */
  const applyThemeToDOM = useCallback((newTheme: Theme) => {
    requestAnimationFrame(() => {
      const htmlElement = document.documentElement;
      htmlElement.setAttribute('data-theme', newTheme);
      
      // Update effective theme for context consumers
      const resolved = resolveEffectiveTheme(newTheme);
      setEffectiveTheme(resolved);
    });
  }, []);

  /**
   * Fetch initial theme from settings on mount.
   */
  useEffect(() => {
    async function loadTheme() {
      try {
        const settings = await window.api.getSettings();
        const initialTheme = settings.appearance.theme;
        setThemeState(initialTheme);
        applyThemeToDOM(initialTheme);
      } catch (error) {
        console.error('Failed to load theme from settings, using dark:', error);
        // Fall back to dark theme on error
        setThemeState('dark');
        applyThemeToDOM('dark');
      }
    }

    loadTheme();
  }, [applyThemeToDOM]);

  /**
   * Listen to OS theme changes when theme is 'system'.
   * Dynamically adds/removes matchMedia listener based on current theme.
   */
  useEffect(() => {
    if (theme !== 'system') {
      return; // Only listen when theme is 'system'
    }

    // Check if matchMedia is available
    if (typeof window === 'undefined' || !window.matchMedia) {
      console.warn('window.matchMedia not available, cannot listen to OS theme changes');
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    /**
     * Handle OS theme preference change.
     */
    const handleChange = (event: { matches: boolean }) => {
      const prefersDark = event.matches;
      const resolved = prefersDark ? 'dark' : 'light';
      setEffectiveTheme(resolved);
      
      // Update data-theme to 'system' (CSS will apply correct colors via media query)
      requestAnimationFrame(() => {
        document.documentElement.setAttribute('data-theme', 'system');
      });
    };

    // Initial check
    handleChange(mediaQuery);

    // Listen for changes
    try {
      // Modern API
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch {
      // Fallback for older browsers (deprecated addListener/removeListener API)
      try {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      } catch (fallbackError) {
        console.warn('Failed to listen to OS theme changes:', fallbackError);
        return undefined;
      }
    }
  }, [theme]);

  /**
   * Update theme in settings and apply to DOM.
   */
  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      // Update settings via IPC
      await window.api.updateSettings({
        appearance: { theme: newTheme }
      });
      
      // Update local state
      setThemeState(newTheme);
      
      // Apply to DOM
      applyThemeToDOM(newTheme);
    } catch (error) {
      console.error('Failed to update theme:', error);
      throw error; // Propagate error to caller
    }
  }, [applyThemeToDOM]);

  const contextValue: ThemeContextValue = {
    theme,
    effectiveTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
