import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../Select';

describe('Select', () => {
  const options = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  it('renders a native select by default', () => {
    render(<Select value="dark" onChange={() => {}} options={options} />);

    const select = screen.getByRole('combobox');
    expect((select as HTMLSelectElement).value).toBe('dark');
  });

  it('opens listbox and selects an option', () => {
    const handleChange = vi.fn();

    render(
      <Select
        value="dark"
        onChange={handleChange}
        options={options}
        variant="listbox"
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const option = screen.getByRole('option', { name: 'Light' });
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith('light');
  });

  it('closes the listbox on Escape', () => {
    render(
      <Select
        value="dark"
        onChange={() => {}}
        options={options}
        variant="listbox"
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
