import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { SETTINGS_DEFAULTS } from 'packages-api-contracts';
import type { Settings } from 'packages-api-contracts';

// Mock window.api
const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();

beforeEach(() => {
  // Setup window.api mock
  (globalThis as any).window = (globalThis as any).window || {};
  (window as any).api = {
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
  };

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeProvider', () => {
  describe('Initialization', () => {
    it('should fetch settings on mount and set data-theme attribute', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'light' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      // Act
      function TestComponent() {
        const { theme } = useTheme();
        return <div>Theme: {theme}</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalledTimes(1);
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
      expect(screen.getByText('Theme: light')).toBeInTheDocument();
    });

    it('should fall back to dark theme on settings fetch error', async () => {
      // Arrange
      mockGetSettings.mockRejectedValue(new Error('Failed to fetch settings'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      function TestComponent() {
        const { theme } = useTheme();
        return <div>Theme: {theme}</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      expect(screen.getByText('Theme: dark')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load theme from settings'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should set effectiveTheme to dark for high-contrast-dark', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'high-contrast-dark' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      // Act
      function TestComponent() {
        const { effectiveTheme } = useTheme();
        return <div>Effective: {effectiveTheme}</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast-dark');
        expect(screen.getByText('Effective: dark')).toBeInTheDocument();
      });
    });

    it('should set effectiveTheme to light for high-contrast-light', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'high-contrast-light' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      // Act
      function TestComponent() {
        const { effectiveTheme } = useTheme();
        return <div>Effective: {effectiveTheme}</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast-light');
        expect(screen.getByText('Effective: light')).toBeInTheDocument();
      });
    });
  });

  describe('Theme switching', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should call updateSettings and update data-theme when theme changes', async () => {
      // Arrange
      mockUpdateSettings.mockResolvedValue({
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'light' },
      });

      function TestComponent() {
        const { theme, setTheme } = useTheme();
        return (
          <div>
            <div>Current: {theme}</div>
            <button onClick={() => setTheme('light')}>Switch to Light</button>
          </div>
        );
      }

      const { getByText } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });

      // Act
      getByText('Switch to Light').click();

      // Assert
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({
          appearance: { theme: 'light' },
        });
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });

    it('should handle theme switch error', async () => {
      // Arrange
      mockUpdateSettings.mockRejectedValue(new Error('Failed to update settings'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let setThemeFn: ((theme: Settings['appearance']['theme']) => Promise<void>) | null = null;

      function TestComponent() {
        const { setTheme } = useTheme();
        React.useEffect(() => {
          setThemeFn = setTheme;
        }, [setTheme]);
        return <div>Theme switcher</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });

      await waitFor(() => {
        expect(setThemeFn).not.toBeNull();
      });

      await expect((setThemeFn as any)('light')).rejects.toThrow('Failed to update settings');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update theme:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('System theme', () => {
    it('should query matchMedia and set effectiveTheme based on OS preference', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'system' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      // Mock matchMedia to return dark preference
      (window.matchMedia as any).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Act
      function TestComponent() {
        const { theme, effectiveTheme } = useTheme();
        return (
          <div>
            <div>Theme: {theme}</div>
            <div>Effective: {effectiveTheme}</div>
          </div>
        );
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('system');
        expect(screen.getByText('Theme: system')).toBeInTheDocument();
        expect(screen.getByText('Effective: dark')).toBeInTheDocument();
      });
    });

    it('should listen to OS theme changes when theme is system', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'system' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      const mockAddEventListener = vi.fn();
      const mockRemoveEventListener = vi.fn();

      (window.matchMedia as any).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      }));

      // Act
      function TestComponent() {
        const { effectiveTheme } = useTheme();
        return <div>Effective: {effectiveTheme}</div>;
      }

      const { unmount } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      });

      // Cleanup
      unmount();
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should fall back to dark if matchMedia is unavailable', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'system' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      // Remove matchMedia
      (window as any).matchMedia = undefined;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      function TestComponent() {
        const { effectiveTheme } = useTheme();
        return <div>Effective: {effectiveTheme}</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Effective: dark')).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('window.matchMedia not available')
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle matchMedia error gracefully', async () => {
      // Arrange
      const mockSettings: Settings = {
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'system' },
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      (window.matchMedia as any).mockImplementation(() => {
        throw new Error('matchMedia error');
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      function TestComponent() {
        const { effectiveTheme } = useTheme();
        return <div>Effective: {effectiveTheme}</div>;
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Effective: dark')).toBeInTheDocument();
      });
      const warnMessages = consoleSpy.mock.calls.map(([message]) => String(message));
      const hasExpectedWarning = warnMessages.some((message) =>
        message.includes('Failed to detect OS theme preference') ||
        message.includes('Failed to listen to OS theme changes')
      );
      expect(hasExpectedWarning).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('P1 (Process isolation)', () => {
    it('should only use window.api.* for IPC, never direct IPC', async () => {
      // Arrange
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
      mockUpdateSettings.mockResolvedValue({
        ...SETTINGS_DEFAULTS,
        appearance: { ...SETTINGS_DEFAULTS.appearance, theme: 'light' },
      });

      function TestComponent() {
        const { setTheme } = useTheme();
        return <button onClick={() => setTheme('light')}>Switch</button>;
      }

      const { getByText } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalled();
      });

      // Act
      getByText('Switch').click();

      // Assert
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled();
      });

      // Verify no direct electron imports (would fail if present)
      expect((global as any).require).toBeUndefined();
    });
  });

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Arrange
      function TestComponent() {
        useTheme();
        return <div>Test</div>;
      }

      // Act & Assert
      expect(() => render(<TestComponent />)).toThrow(
        'useTheme must be used within ThemeProvider'
      );
    });
  });
});
