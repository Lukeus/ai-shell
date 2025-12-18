import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar';

describe('StatusBar', () => {
  it('renders left content in correct section', () => {
    render(
      <StatusBar
        leftContent={<span data-testid="left-content">No Folder Open</span>}
        rightContent={<span>Right Content</span>}
      />
    );
    
    expect(screen.getByTestId('left-content')).toBeInTheDocument();
    expect(screen.getByText('No Folder Open')).toBeInTheDocument();
  });

  it('renders right content in correct section', () => {
    render(
      <StatusBar
        leftContent={<span>Left Content</span>}
        rightContent={<span data-testid="right-content">UTF-8 | TypeScript</span>}
      />
    );
    
    expect(screen.getByTestId('right-content')).toBeInTheDocument();
    expect(screen.getByText('UTF-8 | TypeScript')).toBeInTheDocument();
  });

  it('renders both left and right content simultaneously', () => {
    render(
      <StatusBar
        leftContent={<span>Workspace: ai-shell</span>}
        rightContent={<span>Ln 42, Col 12</span>}
      />
    );
    
    expect(screen.getByText('Workspace: ai-shell')).toBeInTheDocument();
    expect(screen.getByText('Ln 42, Col 12')).toBeInTheDocument();
  });

  it('handles complex React nodes as content', () => {
    render(
      <StatusBar
        leftContent={
          <div>
            <span>Folder:</span>
            <strong>ai-shell</strong>
          </div>
        }
        rightContent={
          <div>
            <span>Errors: 0</span>
            <span>Warnings: 3</span>
          </div>
        }
      />
    );
    
    expect(screen.getByText('Folder:')).toBeInTheDocument();
    expect(screen.getByText('ai-shell')).toBeInTheDocument();
    expect(screen.getByText('Errors: 0')).toBeInTheDocument();
    expect(screen.getByText('Warnings: 3')).toBeInTheDocument();
  });

  it('renders empty content without errors', () => {
    const { container } = render(
      <StatusBar
        leftContent={null}
        rightContent={null}
      />
    );
    
    expect(container.querySelector('div')).toBeInTheDocument();
  });
});
