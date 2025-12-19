import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelHeader } from '../PanelHeader';

describe('PanelHeader', () => {
  const mockOnToggleCollapse = vi.fn();

  beforeEach(() => {
    mockOnToggleCollapse.mockClear();
  });

  it('displays the title', () => {
    render(<PanelHeader title="Explorer" collapsed={false} onToggleCollapse={mockOnToggleCollapse} />);
    
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('displays title in uppercase', () => {
    render(<PanelHeader title="explorer" collapsed={false} onToggleCollapse={mockOnToggleCollapse} />);
    
    const titleElement = screen.getByText('explorer');
    expect(titleElement).toHaveClass('uppercase');
  });

  it('shows collapse button when not collapsed', () => {
    render(<PanelHeader title="Terminal" collapsed={false} onToggleCollapse={mockOnToggleCollapse} />);
    
    expect(screen.getByLabelText('Collapse panel')).toBeInTheDocument();
  });

  it('shows expand button when collapsed', () => {
    render(<PanelHeader title="Terminal" collapsed={true} onToggleCollapse={mockOnToggleCollapse} />);
    
    expect(screen.getByLabelText('Expand panel')).toBeInTheDocument();
  });

  it('calls onToggleCollapse when button is clicked', () => {
    render(<PanelHeader title="Explorer" collapsed={false} onToggleCollapse={mockOnToggleCollapse} />);
    
    const button = screen.getByLabelText('Collapse panel');
    fireEvent.click(button);
    
    expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleCollapse when button is clicked in collapsed state', () => {
    render(<PanelHeader title="Explorer" collapsed={true} onToggleCollapse={mockOnToggleCollapse} />);
    
    const button = screen.getByLabelText('Expand panel');
    fireEvent.click(button);
    
    expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('sets aria-expanded to false when collapsed', () => {
    render(<PanelHeader title="Explorer" collapsed={true} onToggleCollapse={mockOnToggleCollapse} />);
    
    const button = screen.getByLabelText('Expand panel');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('sets aria-expanded to true when not collapsed', () => {
    render(<PanelHeader title="Explorer" collapsed={false} onToggleCollapse={mockOnToggleCollapse} />);
    
    const button = screen.getByLabelText('Collapse panel');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders chevron icon with rotation when collapsed', () => {
    const { container } = render(<PanelHeader title="Explorer" collapsed={true} onToggleCollapse={mockOnToggleCollapse} />);
    
    // Check for chevron path (always up, rotated via style)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // The chevron is rotated 180deg when collapsed
    expect(svg).toHaveStyle({ transform: 'rotate(180deg)' });
  });

  it('renders chevron up icon when not collapsed', () => {
    const { container } = render(<PanelHeader title="Explorer" collapsed={false} onToggleCollapse={mockOnToggleCollapse} />);
    
    // Check for chevron up path (M5 15l7-7 7 7)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const path = svg?.querySelector('path[d="M5 15l7-7 7 7"]');
    expect(path).toBeInTheDocument();
    // The chevron is not rotated when not collapsed
    expect(svg).toHaveStyle({ transform: 'rotate(0deg)' });
  });
});
