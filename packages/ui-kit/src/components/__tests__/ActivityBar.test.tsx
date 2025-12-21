import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityBar } from '../ActivityBar';

describe('ActivityBar', () => {
  const mockOnIconClick = vi.fn();

  beforeEach(() => {
    mockOnIconClick.mockClear();
  });

  it('renders 6 icons', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
  });

  it('renders all expected icon labels', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Source Control' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run and Debug' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extensions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('applies active class to the active icon', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const explorerButton = screen.getByRole('button', { name: 'Explorer' });
    expect(explorerButton).toHaveClass('border-accent');
    expect(explorerButton).toHaveClass('text-primary');
  });

  it('does not apply active class to inactive icons', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).not.toHaveClass('border-accent');
    expect(searchButton).toHaveClass('text-secondary');
  });

  it('calls onIconClick with correct icon ID when icon is clicked', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchButton);
    
    expect(mockOnIconClick).toHaveBeenCalledTimes(1);
    expect(mockOnIconClick).toHaveBeenCalledWith('search');
  });

  it('calls onIconClick for multiple different icons', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Extensions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    
    expect(mockOnIconClick).toHaveBeenCalledTimes(3);
    expect(mockOnIconClick).toHaveBeenNthCalledWith(1, 'explorer');
    expect(mockOnIconClick).toHaveBeenNthCalledWith(2, 'extensions');
    expect(mockOnIconClick).toHaveBeenNthCalledWith(3, 'settings');
  });

  it('sets aria-pressed to true for active icon', () => {
    render(<ActivityBar activeIcon="search" onIconClick={mockOnIconClick} />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('sets aria-pressed to false for inactive icons', () => {
    render(<ActivityBar activeIcon="search" onIconClick={mockOnIconClick} />);
    
    const explorerButton = screen.getByRole('button', { name: 'Explorer' });
    expect(explorerButton).toHaveAttribute('aria-pressed', 'false');
  });
});
