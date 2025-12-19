import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResizablePanel } from '../ResizablePanel';

describe('ResizablePanel', () => {
  const mockOnResize = vi.fn();
  const mockOnToggleCollapse = vi.fn();

  const defaultProps = {
    direction: 'horizontal' as const,
    size: 300,
    minSize: 200,
    maxSize: 600,
    collapsed: false,
    onResize: mockOnResize,
    onToggleCollapse: mockOnToggleCollapse,
    children: <div data-testid="panel-content">Panel Content</div>,
  };

  beforeEach(() => {
    mockOnResize.mockClear();
    mockOnToggleCollapse.mockClear();
  });

  it('renders panel content when not collapsed', () => {
    render(<ResizablePanel {...defaultProps} />);
    expect(screen.getByTestId('panel-content')).toBeInTheDocument();
  });

  it('hides panel content when collapsed', () => {
    render(<ResizablePanel {...defaultProps} collapsed={true} />);
    expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument();
  });

  it('shows expand button when collapsed', () => {
    render(<ResizablePanel {...defaultProps} collapsed={true} />);
    expect(screen.getByLabelText('Expand panel')).toBeInTheDocument();
  });

  it('calls onToggleCollapse when toggle button is clicked', () => {
    render(<ResizablePanel {...defaultProps} />);
    
    const collapseButton = screen.getByLabelText('Collapse panel');
    fireEvent.click(collapseButton);
    
    expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleCollapse when expand button is clicked in collapsed state', () => {
    render(<ResizablePanel {...defaultProps} collapsed={true} />);
    
    const expandButton = screen.getByLabelText('Expand panel');
    fireEvent.click(expandButton);
    
    expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders drag handle with correct ARIA attributes', () => {
    render(<ResizablePanel {...defaultProps} />);
    
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    expect(separator).toHaveAttribute('aria-valuenow', '300');
    expect(separator).toHaveAttribute('aria-valuemin', '200');
    expect(separator).toHaveAttribute('aria-valuemax', '600');
  });

  it('renders with correct ARIA valuemin and valuemax for size constraints', () => {
    render(<ResizablePanel {...defaultProps} size={250} minSize={200} maxSize={600} />);
    
    const separator = screen.getByRole('separator');
    
    // Verify ARIA attributes reflect size constraints
    expect(separator).toHaveAttribute('aria-valuemin', '200');
    expect(separator).toHaveAttribute('aria-valuemax', '600');
    expect(separator).toHaveAttribute('aria-valuenow', '250');
  });

  it('applies correct cursor for horizontal panels', () => {
    const { container } = render(<ResizablePanel {...defaultProps} direction="horizontal" />);
    const separator = container.querySelector('[role="separator"]');
    // VS Code uses cursor-col-resize for horizontal resizing
    expect(separator).toHaveClass('cursor-col-resize');
  });

  it('applies correct cursor for vertical panels', () => {
    const { container } = render(<ResizablePanel {...defaultProps} direction="vertical" />);
    const separator = container.querySelector('[role="separator"]');
    // VS Code uses cursor-row-resize for vertical resizing
    expect(separator).toHaveClass('cursor-row-resize');
  });
});
