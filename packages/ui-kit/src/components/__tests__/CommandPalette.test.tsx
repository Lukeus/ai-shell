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

    const options = screen.getAllByRole('option');
    const labels = options.map((option) => option.textContent ?? '');

    expect(options).toHaveLength(2);
    expect(labels.some((label) => label.includes('Open File'))).toBe(true);
    expect(labels.some((label) => label.includes('Open Folder'))).toBe(true);
    expect(labels.some((label) => label.includes('Close Window'))).toBe(false);
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

    const option = screen.getAllByRole('option').find((node) =>
      node.textContent?.includes('Open File')
    );

    expect(option).toBeTruthy();
    fireEvent.mouseDown(option as HTMLElement);

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
        config={{
          getItemDisabled: (item) => Boolean(item.disabled),
        }}
      />
    );

    const disabledOption = screen.getByRole('option', { name: 'Close Window' });
    expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
  });
});
