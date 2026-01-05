import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Breadcrumbs } from '../Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders items and separators', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Workspace', href: '/workspace' },
          { label: 'src', onClick: () => undefined },
          { label: 'App.tsx', current: true },
        ]}
      />
    );

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getAllByTestId('breadcrumb-separator')).toHaveLength(2);
  });

  it('sets aria-current on the current item', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Workspace', href: '/workspace' },
          { label: 'App.tsx', current: true },
        ]}
      />
    );

    expect(screen.getByText('App.tsx')).toHaveAttribute('aria-current', 'page');
  });

  it('handles click callbacks', () => {
    const onClick = vi.fn();
    render(
      <Breadcrumbs
        items={[
          { label: 'Workspace', href: '/workspace' },
          { label: 'src', onClick },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'src' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders icons when provided', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Workspace', icon: <span data-testid="crumb-icon" /> },
          { label: 'App.tsx', current: true },
        ]}
      />
    );

    expect(screen.getByTestId('crumb-icon')).toBeInTheDocument();
  });
});
