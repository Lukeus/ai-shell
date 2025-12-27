import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProblemsView } from './ProblemsView';
import type { DiagnosticsUpdateEvent, Diagnostic } from 'packages-api-contracts';

const mockDiagnosticsApi = {
  publish: vi.fn(),
  clear: vi.fn(),
  list: vi.fn(),
  onUpdate: vi.fn(),
  onSummary: vi.fn(),
};

const baseDiagnostic: Diagnostic = {
  id: '00000000-0000-4000-8000-000000000001',
  severity: 'error',
  message: 'Type error',
  filePath: '/workspace/src/index.ts',
  location: {
    startLine: 10,
    startColumn: 5,
    endLine: 10,
    endColumn: 12,
  },
  source: 'TypeScript',
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).api = {
    diagnostics: mockDiagnosticsApi,
  };

  mockDiagnosticsApi.onUpdate.mockReturnValue(vi.fn());
  mockDiagnosticsApi.onSummary.mockReturnValue(vi.fn());
  mockDiagnosticsApi.list.mockResolvedValue({
    diagnostics: [],
    summary: { errorCount: 0, warningCount: 0, infoCount: 0, hintCount: 0 },
  });

  // Mock element measurements for virtualization.
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 800,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 400,
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
  });
});

describe('ProblemsView', () => {
  it('loads initial diagnostics and renders counts', async () => {
    mockDiagnosticsApi.list.mockResolvedValueOnce({
      diagnostics: [
        baseDiagnostic,
        { ...baseDiagnostic, id: '00000000-0000-4000-8000-000000000002', severity: 'warning' },
        { ...baseDiagnostic, id: '00000000-0000-4000-8000-000000000003', severity: 'info' },
      ],
      summary: { errorCount: 1, warningCount: 1, infoCount: 1, hintCount: 0 },
    });

    render(<ProblemsView />);

    await waitFor(() => {
      expect(screen.getByText('1 error')).toBeDefined();
      expect(screen.getByText('1 warning')).toBeDefined();
      expect(screen.getByText('1 info')).toBeDefined();
    });
  });

  it('subscribes to diagnostics updates on mount', async () => {
    render(<ProblemsView />);

    await waitFor(() => {
      expect(mockDiagnosticsApi.onUpdate).toHaveBeenCalled();
    });
  });

  it('renders summary counts and diagnostics when updates arrive', async () => {
    let updateCallback: ((event: DiagnosticsUpdateEvent) => void) | undefined;

    mockDiagnosticsApi.onUpdate.mockImplementation((callback: (event: DiagnosticsUpdateEvent) => void) => {
      updateCallback = callback;
      return vi.fn();
    });

    render(<ProblemsView />);

    await waitFor(() => {
      expect(updateCallback).toBeDefined();
    });

    updateCallback?.({
      filePath: baseDiagnostic.filePath,
      source: baseDiagnostic.source,
      diagnostics: [baseDiagnostic],
    });

    await waitFor(() => {
      expect(screen.getByText('1 error')).toBeDefined();
      expect(screen.getByText('0 warnings')).toBeDefined();
      expect(screen.getByText('0 infos')).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('diagnostic-row').length).toBe(1);
    });
  });

  it('sorts diagnostics by severity (error, warning, info, hint)', async () => {
    let updateCallback: ((event: DiagnosticsUpdateEvent) => void) | undefined;

    mockDiagnosticsApi.onUpdate.mockImplementation((callback: (event: DiagnosticsUpdateEvent) => void) => {
      updateCallback = callback;
      return vi.fn();
    });

    const diagnostics: Diagnostic[] = [
      {
        ...baseDiagnostic,
        id: '00000000-0000-4000-8000-000000000002',
        severity: 'info',
        message: 'Info message',
        source: 'ESLint',
      },
      {
        ...baseDiagnostic,
        id: '00000000-0000-4000-8000-000000000003',
        severity: 'error',
        message: 'Error message',
      },
      {
        ...baseDiagnostic,
        id: '00000000-0000-4000-8000-000000000004',
        severity: 'warning',
        message: 'Warning message',
      },
    ];

    render(<ProblemsView />);

    await waitFor(() => {
      expect(updateCallback).toBeDefined();
    });

    updateCallback?.({
      filePath: baseDiagnostic.filePath,
      source: baseDiagnostic.source,
      diagnostics,
    });

    await waitFor(() => {
      const messages = screen.getAllByTestId('diagnostic-message').map((node) => node.textContent);
      expect(messages).toEqual(['Error message', 'Warning message', 'Info message']);
    });
  });

  it('cleans up diagnostics listeners on unmount', async () => {
    const unsubscribe = vi.fn();
    mockDiagnosticsApi.onUpdate.mockReturnValue(unsubscribe);

    const { unmount } = render(<ProblemsView />);

    await waitFor(() => {
      expect(mockDiagnosticsApi.onUpdate).toHaveBeenCalled();
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
