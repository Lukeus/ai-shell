import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders the label', () => {
    render(<Badge label="Tracked" />);
    expect(screen.getByText('Tracked')).toBeInTheDocument();
  });

  it('renders as a button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<Badge label="Tracked" onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Tracked' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalled();
  });

  it('applies variant styles', () => {
    render(<Badge label="Success" variant="success" />);
    const badge = screen.getByText('Success');

    expect(badge).toHaveStyle({
      color: 'var(--color-status-success)',
      borderColor: 'var(--color-status-success)',
    });
  });
});
