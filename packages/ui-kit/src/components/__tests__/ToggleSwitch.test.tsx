import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ToggleSwitch } from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders label text when provided', () => {
    render(<ToggleSwitch checked={false} onChange={() => undefined} label="Enable feature" />);
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
  });

  it('exposes switch role and checked state', () => {
    render(<ToggleSwitch checked={true} onChange={() => undefined} label="Enabled" />);
    const switchButton = screen.getByRole('switch', { name: 'Enabled' });
    expect(switchButton).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles on click', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} label="Notifications" />);
    const switchButton = screen.getByRole('switch', { name: 'Notifications' });
    fireEvent.click(switchButton);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles on keyboard interaction', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} label="Telemetry" />);
    const switchButton = screen.getByRole('switch', { name: 'Telemetry' });
    fireEvent.keyDown(switchButton, { key: ' ', code: 'Space' });
    fireEvent.keyUp(switchButton, { key: ' ', code: 'Space' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', () => {
    const onChange = vi.fn();
    render(
      <ToggleSwitch checked={false} onChange={onChange} label="Disabled" disabled />
    );
    const switchButton = screen.getByRole('switch', { name: 'Disabled' });
    fireEvent.click(switchButton);
    fireEvent.keyDown(switchButton, { key: ' ', code: 'Space' });
    fireEvent.keyUp(switchButton, { key: ' ', code: 'Space' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
