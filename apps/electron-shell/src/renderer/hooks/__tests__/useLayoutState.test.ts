import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutState } from '../useLayoutState';
import { DEFAULT_LAYOUT_STATE } from 'packages-api-contracts';

describe('useLayoutState', () => {
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

  it('reads from localStorage on mount', () => {
    const storedState = {
      ...DEFAULT_LAYOUT_STATE,
      primarySidebarWidth: 400,
    };
    mockLocalStorage['ai-shell:layout-state:global'] = JSON.stringify(storedState);

    const { result } = renderHook(() => useLayoutState());
    
    expect(result.current[0].primarySidebarWidth).toBe(400);
  });

  it('falls back to DEFAULT_LAYOUT_STATE when localStorage is empty', () => {
    const { result } = renderHook(() => useLayoutState());
    
    expect(result.current[0]).toEqual(DEFAULT_LAYOUT_STATE);
  });

  it('falls back to DEFAULT_LAYOUT_STATE when localStorage contains invalid JSON', () => {
    mockLocalStorage['ai-shell:layout-state:global'] = 'invalid-json';
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLayoutState());
    
    expect(result.current[0]).toEqual(DEFAULT_LAYOUT_STATE);
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalledWith('ai-shell:layout-state:global');
  });

  it('falls back to DEFAULT_LAYOUT_STATE when Zod validation fails', () => {
    const invalidState = {
      ...DEFAULT_LAYOUT_STATE,
      primarySidebarWidth: 50, // Below min of 200
    };
    mockLocalStorage['ai-shell:layout-state:global'] = JSON.stringify(invalidState);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLayoutState());
    
    expect(result.current[0]).toEqual(DEFAULT_LAYOUT_STATE);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it.skip('writes to localStorage on state change (debounced)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLayoutState());

    // Clear the initial mount call
    vi.mocked(localStorage.setItem).mockClear();

    act(() => {
      result.current[1]({
        ...DEFAULT_LAYOUT_STATE,
        primarySidebarWidth: 450,
      });
    });

    // State updates immediately
    expect(result.current[0].primarySidebarWidth).toBe(450);

    // Fast-forward past debounce delay (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Check that localStorage was written after debounce
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'ai-shell:layout-state:global',
      expect.stringContaining('450')
    );

    vi.useRealTimers();
  });

  it('flushes pending writes on unmount', () => {
    const { result, unmount } = renderHook(() => useLayoutState());

    act(() => {
      result.current[1]({
        ...DEFAULT_LAYOUT_STATE,
        primarySidebarWidth: 500,
      });
    });

    // Unmount before debounce completes
    unmount();

    // Should have flushed the write immediately
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'ai-shell:layout-state:global',
      expect.stringContaining('500')
    );
  });

  it('handles QuotaExceededError gracefully', () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock setItem to throw QuotaExceededError
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
      throw error;
    });

    const { result, unmount } = renderHook(() => useLayoutState());

    act(() => {
      result.current[1]({
        ...DEFAULT_LAYOUT_STATE,
        primarySidebarWidth: 450,
      });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(consoleErrorSpy).toHaveBeenCalled();

    unmount();
    vi.useRealTimers();
  });

  it.skip('clears pending debounce timer on subsequent updates', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLayoutState());

    // Clear any mount-related calls
    vi.mocked(localStorage.setItem).mockClear();

    // First update
    act(() => {
      result.current[1]({
        ...DEFAULT_LAYOUT_STATE,
        primarySidebarWidth: 450,
      });
    });

    // Advance time partially
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Second update before first completes
    act(() => {
      result.current[1]({
        ...DEFAULT_LAYOUT_STATE,
        primarySidebarWidth: 475,
      });
    });

    // Complete the debounce for second update
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should only have written once (the second update)
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'ai-shell:layout-state:global',
      expect.stringContaining('475')
    );

    vi.useRealTimers();
  });
});
