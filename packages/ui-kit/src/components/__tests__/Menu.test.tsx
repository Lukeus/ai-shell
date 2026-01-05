import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Menu } from '../Menu';

describe('Menu', () => {
  const items = [
    { id: 'rename', label: 'Rename', onClick: vi.fn() },
    { type: 'separator' as const },
    { id: 'delete', label: 'Delete', disabled: true },
  ];

  it('opens and renders items with separators', () => {
    render(
      <Menu
        triggerLabel="Actions"
        items={items}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('calls onClick for enabled items', () => {
    const onClick = vi.fn();
    render(
      <Menu
        triggerLabel="Actions"
        items={[{ id: 'rename', label: 'Rename', onClick }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(onClick).toHaveBeenCalled();
  });

  it('marks disabled items as aria-disabled', () => {
    render(
      <Menu
        triggerLabel="Actions"
        items={items}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));

    const disabledItem = screen.getByRole('menuitem', { name: 'Delete' });
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders menuitems with expected roles', () => {
    render(
      <Menu
        triggerLabel="Actions"
        items={items}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });
});
