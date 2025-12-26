import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar, type Tab } from './TabBar';

describe('TabBar', () => {
  const mockTabs: Tab[] = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'output', label: 'Output' },
    { id: 'problems', label: 'Problems' },
  ];

  it('should render all tabs', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Terminal' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Output' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Problems' })).toBeInTheDocument();
  });

  it('should mark the active tab with aria-selected', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="output"
        onChange={handleChange}
      />
    );

    const outputTab = screen.getByRole('tab', { name: 'Output' });
    expect(outputTab).toHaveAttribute('aria-selected', 'true');
    
    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    expect(terminalTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should call onChange when a tab is clicked', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    expect(handleChange).toHaveBeenCalledWith('output');
  });

  it('should not call onChange when disabled tab is clicked', () => {
    const handleChange = vi.fn();
    const tabsWithDisabled: Tab[] = [
      { id: 'terminal', label: 'Terminal' },
      { id: 'output', label: 'Output', disabled: true },
      { id: 'problems', label: 'Problems' },
    ];
    
    render(
      <TabBar
        tabs={tabsWithDisabled}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.click(outputTab);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should render icons when provided', () => {
    const tabsWithIcons: Tab[] = [
      {
        id: 'terminal',
        label: 'Terminal',
        icon: <span data-testid="terminal-icon">$</span>,
      },
      { id: 'output', label: 'Output' },
    ];
    
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={tabsWithIcons}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    expect(screen.getByTestId('terminal-icon')).toBeInTheDocument();
  });

  it('should navigate tabs with keyboard (ArrowRight)', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    fireEvent.keyDown(terminalTab, { key: 'ArrowRight' });

    expect(handleChange).toHaveBeenCalledWith('output');
  });

  it('should navigate tabs with keyboard (ArrowLeft)', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="output"
        onChange={handleChange}
      />
    );

    const outputTab = screen.getByRole('tab', { name: 'Output' });
    fireEvent.keyDown(outputTab, { key: 'ArrowLeft' });

    expect(handleChange).toHaveBeenCalledWith('terminal');
  });

  it('should wrap around when navigating with ArrowRight from last tab', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="problems"
        onChange={handleChange}
      />
    );

    const problemsTab = screen.getByRole('tab', { name: 'Problems' });
    fireEvent.keyDown(problemsTab, { key: 'ArrowRight' });

    expect(handleChange).toHaveBeenCalledWith('terminal');
  });

  it('should navigate to first tab with Home key', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="problems"
        onChange={handleChange}
      />
    );

    const problemsTab = screen.getByRole('tab', { name: 'Problems' });
    fireEvent.keyDown(problemsTab, { key: 'Home' });

    expect(handleChange).toHaveBeenCalledWith('terminal');
  });

  it('should navigate to last tab with End key', () => {
    const handleChange = vi.fn();
    
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    fireEvent.keyDown(terminalTab, { key: 'End' });

    expect(handleChange).toHaveBeenCalledWith('problems');
  });

  it('should skip disabled tabs when navigating with keyboard', () => {
    const handleChange = vi.fn();
    const tabsWithDisabled: Tab[] = [
      { id: 'terminal', label: 'Terminal' },
      { id: 'output', label: 'Output', disabled: true },
      { id: 'problems', label: 'Problems' },
    ];
    
    render(
      <TabBar
        tabs={tabsWithDisabled}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    fireEvent.keyDown(terminalTab, { key: 'ArrowRight' });

    // Should skip disabled 'output' tab and go to 'problems'
    expect(handleChange).toHaveBeenCalledWith('problems');
  });

  it('should expose tablist and tabs for accessibility', () => {
    const handleChange = vi.fn();
    
    const { container } = render(
      <TabBar
        tabs={mockTabs}
        activeTabId="terminal"
        onChange={handleChange}
      />
    );

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });
});

