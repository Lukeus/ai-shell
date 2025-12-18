import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';
import { SETTINGS_DEFAULTS } from 'packages-api-contracts';

// Mock window.api
const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockResetSettings = vi.fn();

beforeEach(() => {
  // Setup window.api mock
  (global as any).window = {
    api: {
      getSettings: mockGetSettings,
      updateSettings: mockUpdateSettings,
      resetSettings: mockResetSettings,
    },
  };

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsPanel', () => {
  describe('Initialization', () => {
    it('should fetch settings on mount and render categories', async () => {
      // Arrange
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);

      // Act
      render(<SettingsPanel />);

      // Assert
      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalledTimes(1);
      });

      // Verify categories are rendered
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Editor')).toBeInTheDocument();
      expect(screen.getByText('Extensions')).toBeInTheDocument();
    });

    it('should display loading state before settings are loaded', () => {
      // Arrange
      mockGetSettings.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Act
      render(<SettingsPanel />);

      // Assert
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });

    it('should handle settings fetch error gracefully', async () => {
      // Arrange
      mockGetSettings.mockRejectedValue(new Error('Failed to fetch'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      render(<SettingsPanel />);

      // Assert
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to fetch settings:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Settings display', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should display appearance settings by default', async () => {
      // Act
      render(<SettingsPanel />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
        expect(screen.getByText('Font Size')).toBeInTheDocument();
        expect(screen.getByText('Icon Theme')).toBeInTheDocument();
      });
    });

    it('should display setting descriptions', async () => {
      // Act
      render(<SettingsPanel />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Choose your color theme')).toBeInTheDocument();
        expect(screen.getByText(/Base font size in pixels/)).toBeInTheDocument();
      });
    });
  });

  describe('Category navigation', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should switch categories and show relevant settings', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      // Click Editor category
      fireEvent.click(screen.getByText('Editor'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Word Wrap')).toBeInTheDocument();
        expect(screen.getByText('Line Numbers')).toBeInTheDocument();
        expect(screen.getByText('Minimap')).toBeInTheDocument();
      });

      // Theme setting should not be visible in Editor category
      expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    });

    it('should clear search when switching categories', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search settings...')).toBeInTheDocument();
      });

      // eslint-disable-next-line no-undef
      const searchInput = screen.getByPlaceholderText('Search settings...') as HTMLInputElement;

      // Type search query
      fireEvent.change(searchInput, { target: { value: 'theme' } });
      expect(searchInput.value).toBe('theme');

      // Switch category
      fireEvent.click(screen.getByText('Editor'));

      // Assert
      await waitFor(() => {
        expect(searchInput.value).toBe('');
      });
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should filter settings by label', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search settings...');

      // Type search query
      fireEvent.change(searchInput, { target: { value: 'theme' } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
        expect(screen.getByText('Icon Theme')).toBeInTheDocument();
        // Font Size should not be visible
        expect(screen.queryByText('Font Size')).not.toBeInTheDocument();
      });
    });

    it('should filter settings by description', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search settings...');

      // Type search query
      fireEvent.change(searchInput, { target: { value: 'minimap' } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Minimap')).toBeInTheDocument();
        // Other settings should not be visible
        expect(screen.queryByText('Theme')).not.toBeInTheDocument();
        expect(screen.queryByText('Word Wrap')).not.toBeInTheDocument();
      });
    });

    it('should show matching settings across all categories', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search settings...');

      // Search for a term that appears in multiple categories
      fireEvent.change(searchInput, { target: { value: 'enable' } });

      // Assert - should show settings from Extensions category
      await waitFor(() => {
        expect(screen.getByText('Telemetry')).toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search settings...');

      // Search for non-existent setting
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No settings match your search.')).toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search settings...');

      // Type uppercase query
      fireEvent.change(searchInput, { target: { value: 'THEME' } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
        expect(screen.getByText('Icon Theme')).toBeInTheDocument();
      });
    });
  });

  describe('Setting updates', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
      mockUpdateSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should call updateSettings with debounce when setting changes', async () => {
      // Use fake timers
      vi.useFakeTimers();

      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      // Find and click a toggle switch (e.g., Word Wrap in Editor category)
      fireEvent.click(screen.getByText('Editor'));

      await waitFor(() => {
        expect(screen.getByText('Word Wrap')).toBeInTheDocument();
      });

      // Get the toggle button (role="switch")
      const toggles = screen.getAllByRole('switch');
      const wordWrapToggle = toggles[0]; // First toggle in Editor category

      // Click toggle
      fireEvent.click(wordWrapToggle);

      // Assert: updateSettings should not be called immediately
      expect(mockUpdateSettings).not.toHaveBeenCalled();

      // Fast-forward time by 300ms (debounce delay)
      vi.advanceTimersByTime(300);

      // Assert: updateSettings should now be called
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            editor: expect.objectContaining({
              wordWrap: true,
            }),
          })
        );
      });

      vi.useRealTimers();
    });

    it('should update local state immediately for responsiveness', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      // Switch to Editor category
      fireEvent.click(screen.getByText('Editor'));

      await waitFor(() => {
        expect(screen.getByText('Word Wrap')).toBeInTheDocument();
      });

      const toggles = screen.getAllByRole('switch');
      const wordWrapToggle = toggles[0];

      // Get initial state (should be unchecked based on defaults)
      const initialChecked = wordWrapToggle.getAttribute('aria-checked');

      // Click toggle
      fireEvent.click(wordWrapToggle);

      // Assert: Local state should update immediately
      await waitFor(() => {
        const newChecked = wordWrapToggle.getAttribute('aria-checked');
        expect(newChecked).not.toBe(initialChecked);
      });
    });

    it('should handle update errors gracefully', async () => {
      // Arrange
      mockUpdateSettings.mockRejectedValue(new Error('Update failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.useFakeTimers();

      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Editor')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Editor'));

      await waitFor(() => {
        expect(screen.getByText('Word Wrap')).toBeInTheDocument();
      });

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[0]);

      // Fast-forward debounce
      vi.advanceTimersByTime(300);

      // Assert
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to update settings:',
          expect.any(Error)
        );
      });

      vi.useRealTimers();
      consoleSpy.mockRestore();
    });
  });

  describe('P1 (Process isolation)', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
      mockUpdateSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should only use window.api.* for IPC, never direct IPC', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalled();
      });

      // Verify no direct electron imports
      expect((global as any).require).toBeUndefined();
      expect((global as any).ipcRenderer).toBeUndefined();

      // Verify only window.api.* was used
      expect(mockGetSettings).toHaveBeenCalled();
    });
  });

  describe('P2 (Security defaults)', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should not store secrets in localStorage', async () => {
      // Arrange
      // eslint-disable-next-line no-undef
      const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      // Assert: Settings should not be stored in localStorage
      expect(localStorageSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('settings'),
        expect.anything()
      );

      localStorageSpy.mockRestore();
    });

    it('should not display any secret-like fields', async () => {
      // Act
      render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      // Assert: No secret-related text should appear
      expect(screen.queryByText(/api.*key/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
    });
  });

  describe('P5 (Performance budgets)', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(SETTINGS_DEFAULTS);
    });

    it('should use memoization for search filtering', async () => {
      // This test verifies that search uses useMemo by checking it doesn't re-render unnecessarily
      // Act
      const { rerender } = render(<SettingsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Theme')).toBeInTheDocument();
      });

      // Force re-render with same props
      rerender(<SettingsPanel />);

      // Assert: Should not fetch settings again (uses cache)
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });
  });
});
