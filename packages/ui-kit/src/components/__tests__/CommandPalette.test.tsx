import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommandPalette } from '../CommandPalette';

type Item = { id: string; label: string; disabled?: boolean };

describe('CommandPalette', () => {
  const items: Item[] = [
    { id: 'open-file', label: 'Open File' },
    { id: 'open-folder', label: 'Open Folder' },
    { id: 'close-window', label: 'Close Window', disabled: true },
  ];

  it('renders dialog and input when open', () => {
    render(
      <CommandPalette
        open
        onClose={() => undefined}
        items={items}
        onSelect={() => undefined}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Command Palette' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('filters items using the query prefix', () => {
    render(
      <CommandPalette
        open
        onClose={() => undefined}
        items={items}
        onSelect={() => undefined}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '> open f' } });

    expect(screen.getByText('Open File')).toBeInTheDocument();
    expect(screen.getByText('Open Folder')).toBeInTheDocument();
    expect(screen.queryByText('Close Window')).not.toBeInTheDocument();
  });

  it('calls onSelect and onClose when an option is chosen', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        open
        onClose={onClose}
        items={items}
        onSelect={onSelect}
      />
    );

    const option = screen.getByRole('option', { name: 'Open File' });
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('marks disabled items as aria-disabled', () => {
    render(
      <CommandPalette
        open
        onClose={() => undefined}
        items={items}
        onSelect={() => undefined}
        getItemDisabled={(item) => Boolean(item.disabled)}
      />
    );

    const disabledOption = screen.getByRole('option', { name: 'Close Window' });
    expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
  });
});
