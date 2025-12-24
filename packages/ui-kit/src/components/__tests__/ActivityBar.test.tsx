import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityBar } from '../ActivityBar';

describe('ActivityBar', () => {
  const mockOnIconClick = vi.fn();

  beforeEach(() => {
    mockOnIconClick.mockClear();
  });

  it('renders 7 icons', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
  });

  it('renders all expected icon labels', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Source Control' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Run and Debug' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Extensions' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'SDD' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();
  });

  it('applies active class to the active icon', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const explorerTab = screen.getByRole('tab', { name: 'Explorer' });
    expect(explorerTab).toHaveClass('border-accent');
    expect(explorerTab).toHaveClass('text-primary');
  });

  it('does not apply active class to inactive icons', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const searchTab = screen.getByRole('tab', { name: 'Search' });
    expect(searchTab).not.toHaveClass('border-accent');
    expect(searchTab).toHaveClass('text-secondary');
  });

  it('calls onIconClick with correct icon ID when icon is clicked', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    const searchTab = screen.getByRole('tab', { name: 'Search' });
    fireEvent.click(searchTab);
    
    expect(mockOnIconClick).toHaveBeenCalledTimes(1);
    expect(mockOnIconClick).toHaveBeenCalledWith('search');
  });

  it('calls onIconClick for multiple different icons', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);
    
    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Extensions' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    
    expect(mockOnIconClick).toHaveBeenCalledTimes(3);
    expect(mockOnIconClick).toHaveBeenNthCalledWith(1, 'explorer');
    expect(mockOnIconClick).toHaveBeenNthCalledWith(2, 'extensions');
    expect(mockOnIconClick).toHaveBeenNthCalledWith(3, 'settings');
  });

  it('supports keyboard navigation with ArrowDown', () => {
    render(<ActivityBar activeIcon="explorer" onIconClick={mockOnIconClick} />);

    const explorerTab = screen.getByRole('tab', { name: 'Explorer' });
    explorerTab.focus();
    fireEvent.keyDown(explorerTab, { key: 'ArrowDown' });

    expect(mockOnIconClick).toHaveBeenCalledWith('search');
  });

  it('sets aria-selected to true for active icon', () => {
    render(<ActivityBar activeIcon="search" onIconClick={mockOnIconClick} />);
    
    const searchTab = screen.getByRole('tab', { name: 'Search' });
    expect(searchTab).toHaveAttribute('aria-selected', 'true');
  });

  it('sets aria-selected to false for inactive icons', () => {
    render(<ActivityBar activeIcon="search" onIconClick={mockOnIconClick} />);
    
    const explorerTab = screen.getByRole('tab', { name: 'Explorer' });
    expect(explorerTab).toHaveAttribute('aria-selected', 'false');
  });
});
