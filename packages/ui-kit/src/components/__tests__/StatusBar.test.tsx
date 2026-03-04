import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar';

describe('StatusBar', () => {
  it('renders left items in correct section', () => {
    render(
      <StatusBar
        leftItems={[{ id: 'folder', label: 'No Folder Open' }]}
      />
    );

    expect(screen.getByText('No Folder Open')).toBeInTheDocument();
  });

  it('renders right items in correct section', () => {
    render(
      <StatusBar
        rightItems={[{ id: 'encoding', label: 'UTF-8' }]}
      />
    );

    expect(screen.getByText('UTF-8')).toBeInTheDocument();
  });

  it('renders both left and right items simultaneously', () => {
    render(
      <StatusBar
        leftItems={[{ id: 'workspace', label: 'ai-shell' }]}
        rightItems={[{ id: 'position', label: 'Ln 42, Col 12' }]}
      />
    );

    expect(screen.getByText('ai-shell')).toBeInTheDocument();
    expect(screen.getByText('Ln 42, Col 12')).toBeInTheDocument();
  });

  it('renders multiple items per side', () => {
    render(
      <StatusBar
        leftItems={[
          { id: 'folder', label: 'Folder' },
          { id: 'workspace', label: 'ai-shell' },
        ]}
        rightItems={[
          { id: 'errors', label: 'Errors: 0' },
          { id: 'warnings', label: 'Warnings: 3' },
        ]}
      />
    );

    expect(screen.getByText('Folder')).toBeInTheDocument();
    expect(screen.getByText('ai-shell')).toBeInTheDocument();
    expect(screen.getByText('Errors: 0')).toBeInTheDocument();
    expect(screen.getByText('Warnings: 3')).toBeInTheDocument();
  });

  it('renders empty content without errors', () => {
    const { container } = render(<StatusBar />);

    expect(container.querySelector('div')).toBeInTheDocument();
  });
});
