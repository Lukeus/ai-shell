import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LayoutProvider, useLayoutContext } from '../LayoutContext';
import { DEFAULT_LAYOUT_STATE } from 'packages-api-contracts';

describe('LayoutContext', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};
    
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test component that uses the context
  function TestComponent() {
    const {
      state,
      updatePrimarySidebarWidth,
      updateSecondarySidebarWidth,
      updateBottomPanelHeight,
      togglePrimarySidebar,
      toggleSecondarySidebar,
      toggleBottomPanel,
      setActiveActivityBarIcon,
      resetLayout,
    } = useLayoutContext();

    return (
      <div>
        <div data-testid="primary-width">{state.primarySidebarWidth}</div>
        <div data-testid="secondary-width">{state.secondarySidebarWidth}</div>
        <div data-testid="bottom-height">{state.bottomPanelHeight}</div>
        <div data-testid="primary-collapsed">{String(state.primarySidebarCollapsed)}</div>
        <div data-testid="secondary-collapsed">{String(state.secondarySidebarCollapsed)}</div>
        <div data-testid="bottom-collapsed">{String(state.bottomPanelCollapsed)}</div>
        <div data-testid="active-icon">{state.activeActivityBarIcon}</div>
        
        <button onClick={() => updatePrimarySidebarWidth(400)}>Update Primary Width</button>
        <button onClick={() => updateSecondarySidebarWidth(350)}>Update Secondary Width</button>
        <button onClick={() => updateBottomPanelHeight(250)}>Update Bottom Height</button>
        <button onClick={togglePrimarySidebar}>Toggle Primary</button>
        <button onClick={toggleSecondarySidebar}>Toggle Secondary</button>
        <button onClick={toggleBottomPanel}>Toggle Bottom</button>
        <button onClick={() => setActiveActivityBarIcon('search')}>Set Active Icon</button>
        <button onClick={resetLayout}>Reset Layout</button>
      </div>
    );
  }

  it('provides default state on mount', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    expect(screen.getByTestId('primary-width')).toHaveTextContent(String(DEFAULT_LAYOUT_STATE.primarySidebarWidth));
    expect(screen.getByTestId('active-icon')).toHaveTextContent(DEFAULT_LAYOUT_STATE.activeActivityBarIcon);
  });

  it('throws error when useLayoutContext is used outside LayoutProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<TestComponent />)).toThrow('useLayoutContext must be used within LayoutProvider');
    
    consoleErrorSpy.mockRestore();
  });

  it('updates primary sidebar width with Zod validation', () => {
    vi.useFakeTimers();
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const button = screen.getByText('Update Primary Width');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('primary-width')).toHaveTextContent('400');

    vi.useRealTimers();
  });

  it('updates secondary sidebar width', () => {
    vi.useFakeTimers();
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const button = screen.getByText('Update Secondary Width');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('secondary-width')).toHaveTextContent('350');

    vi.useRealTimers();
  });

  it('updates bottom panel height', () => {
    vi.useFakeTimers();
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const button = screen.getByText('Update Bottom Height');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('bottom-height')).toHaveTextContent('250');

    vi.useRealTimers();
  });

  it('toggles primary sidebar collapsed state', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const initialState = screen.getByTestId('primary-collapsed').textContent;
    
    const button = screen.getByText('Toggle Primary');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('primary-collapsed')).not.toHaveTextContent(initialState!);
  });

  it('toggles secondary sidebar collapsed state', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const initialState = screen.getByTestId('secondary-collapsed').textContent;
    
    const button = screen.getByText('Toggle Secondary');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('secondary-collapsed')).not.toHaveTextContent(initialState!);
  });

  it('toggles bottom panel collapsed state', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const initialState = screen.getByTestId('bottom-collapsed').textContent;
    
    const button = screen.getByText('Toggle Bottom');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('bottom-collapsed')).not.toHaveTextContent(initialState!);
  });

  it('sets active activity bar icon with Zod validation', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const button = screen.getByText('Set Active Icon');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('active-icon')).toHaveTextContent('search');
  });

  it('rejects invalid sidebar width with Zod validation', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function TestInvalidWidth() {
      const { updatePrimarySidebarWidth, state } = useLayoutContext();
      return (
        <div>
          <div data-testid="width">{state.primarySidebarWidth}</div>
          <button onClick={() => updatePrimarySidebarWidth(50)}>Set Invalid Width</button>
        </div>
      );
    }

    render(
      <LayoutProvider>
        <TestInvalidWidth />
      </LayoutProvider>
    );

    const originalWidth = screen.getByTestId('width').textContent;
    
    const button = screen.getByText('Set Invalid Width');
    act(() => {
      button.click();
    });

    // Width should remain unchanged due to Zod validation failure
    expect(screen.getByTestId('width')).toHaveTextContent(originalWidth!);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('resets layout and clears localStorage', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    // First, change some state
    act(() => {
      screen.getByText('Update Primary Width').click();
    });

    expect(screen.getByTestId('primary-width')).toHaveTextContent('400');

    // Now reset
    const button = screen.getByText('Reset Layout');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('primary-width')).toHaveTextContent(String(DEFAULT_LAYOUT_STATE.primarySidebarWidth));
    expect(localStorage.removeItem).toHaveBeenCalledWith('ai-shell:layout-state:global');
  });

  it('handles keyboard shortcut Ctrl+B to toggle primary sidebar', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const initialState = screen.getByTestId('primary-collapsed').textContent;

    // Simulate Ctrl+B keyboard event
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('primary-collapsed')).not.toHaveTextContent(initialState!);
  });

  it('handles keyboard shortcut Ctrl+J to toggle bottom panel', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const initialState = screen.getByTestId('bottom-collapsed').textContent;

    // Simulate Ctrl+J keyboard event
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('bottom-collapsed')).not.toHaveTextContent(initialState!);
  });

  it('handles keyboard shortcut Ctrl+Shift+E to focus Explorer', () => {
    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    // Simulate Ctrl+Shift+E keyboard event
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('active-icon')).toHaveTextContent('explorer');
  });

  it('verifies no secrets are stored in localStorage (P2: Security defaults)', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    // Update state to trigger localStorage write
    act(() => {
      screen.getByText('Update Primary Width').click();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(localStorage.setItem).toHaveBeenCalled();

    // Verify stored data contains only UI dimensions and booleans (no secrets)
    const storedData = mockLocalStorage['ai-shell:layout-state:global'];
    expect(storedData).toBeDefined();
    
    const parsed = JSON.parse(storedData);
    expect(parsed).toHaveProperty('primarySidebarWidth');
    expect(parsed).toHaveProperty('primarySidebarCollapsed');
    
    // Verify no sensitive fields like passwords, tokens, keys, etc.
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
    const keys = Object.keys(parsed).join(' ').toLowerCase();
    sensitiveFields.forEach(field => {
      expect(keys).not.toContain(field);
    });

    unmount();
    vi.useRealTimers();
  });
});
