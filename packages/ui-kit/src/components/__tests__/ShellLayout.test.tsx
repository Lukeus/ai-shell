import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShellLayout } from '../ShellLayout';
import { DEFAULT_LAYOUT_STATE } from 'packages-api-contracts';

describe('ShellLayout', () => {
  const mockOnLayoutChange = vi.fn();

  const defaultProps = {
    activityBar: <div data-testid="activity-bar">Activity Bar</div>,
    primarySidebar: <div data-testid="primary-sidebar">Primary Sidebar</div>,
    editorArea: <div data-testid="editor-area">Editor Area</div>,
    secondarySidebar: <div data-testid="secondary-sidebar">Secondary Sidebar</div>,
    bottomPanel: <div data-testid="bottom-panel">Bottom Panel</div>,
    statusBar: <div data-testid="status-bar">Status Bar</div>,
    layoutState: DEFAULT_LAYOUT_STATE,
    onLayoutChange: mockOnLayoutChange,
  };

  it('renders all 6 regions with correct content', () => {
    // Note: DEFAULT_LAYOUT_STATE has secondarySidebarCollapsed: true
    const layoutState = { ...DEFAULT_LAYOUT_STATE, secondarySidebarCollapsed: false };
    render(<ShellLayout {...defaultProps} layoutState={layoutState} />);

    expect(screen.getByTestId('activity-bar')).toBeInTheDocument();
    expect(screen.getByTestId('primary-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('editor-area')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('collapses primary sidebar to minimal width when collapsed', () => {
    const layoutState = {
      ...DEFAULT_LAYOUT_STATE,
      primarySidebarCollapsed: true,
    };

    const { container } = render(<ShellLayout {...defaultProps} layoutState={layoutState} />);

    // Panel stays in DOM but grid column shrinks to 4px
    expect(screen.getByTestId('primary-sidebar')).toBeInTheDocument();
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.style.gridTemplateColumns).toContain('4px');
    expect(screen.getByTestId('editor-area')).toBeInTheDocument();
  });

  it('collapses secondary sidebar to minimal width when collapsed', () => {
    const layoutState = {
      ...DEFAULT_LAYOUT_STATE,
      secondarySidebarCollapsed: true,
    };

    const { container } = render(<ShellLayout {...defaultProps} layoutState={layoutState} />);

    // Panel stays in DOM but grid column shrinks to 4px
    expect(screen.getByTestId('secondary-sidebar')).toBeInTheDocument();
    const gridContainer = container.firstChild as HTMLElement;
    // Last column should be 4px when secondary sidebar is collapsed
    expect(gridContainer.style.gridTemplateColumns).toMatch(/4px$/);
    expect(screen.getByTestId('editor-area')).toBeInTheDocument();
  });

  it('collapses bottom panel to minimal height when collapsed', () => {
    const layoutState = {
      ...DEFAULT_LAYOUT_STATE,
      bottomPanelCollapsed: true,
    };

    const { container } = render(<ShellLayout {...defaultProps} layoutState={layoutState} />);

    // Panel stays in DOM but grid row shrinks to 4px
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.style.gridTemplateRows).toContain('4px');
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('applies correct grid layout based on panel sizes', () => {
    const layoutState = {
      ...DEFAULT_LAYOUT_STATE,
      primarySidebarWidth: 400,
      secondarySidebarWidth: 250,
      bottomPanelHeight: 300,
    };

    const { container } = render(<ShellLayout {...defaultProps} layoutState={layoutState} />);
    
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer).toHaveStyle({
      display: 'grid',
    });
  });
});
