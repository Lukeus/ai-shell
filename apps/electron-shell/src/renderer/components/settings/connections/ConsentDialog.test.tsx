import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentDialog } from './ConsentDialog';

describe('ConsentDialog', () => {
  it('renders request details when open', () => {
    render(
      <ConsentDialog
        isOpen={true}
        connectionName="OpenAI"
        requesterId="ext-openai"
        reason="Needs token"
        onAllowOnce={vi.fn()}
        onAllowAlways={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    expect(screen.getByText('Allow secret access?')).toBeInTheDocument();
    expect(screen.getByText('ext-openai')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText(/Needs token/)).toBeInTheDocument();
  });

  it('invokes callbacks for actions', () => {
    const onAllowOnce = vi.fn();
    const onAllowAlways = vi.fn();
    const onDeny = vi.fn();

    render(
      <ConsentDialog
        isOpen={true}
        connectionName="GitHub"
        requesterId="ext-github"
        onAllowOnce={onAllowOnce}
        onAllowAlways={onAllowAlways}
        onDeny={onDeny}
      />
    );

    fireEvent.click(screen.getByText('Allow once'));
    expect(onAllowOnce).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Always allow'));
    expect(onAllowAlways).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Deny'));
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it('denies on escape key', () => {
    const onDeny = vi.fn();

    render(
      <ConsentDialog
        isOpen={true}
        connectionName="Postgres"
        requesterId="ext-db"
        onAllowOnce={vi.fn()}
        onAllowAlways={vi.fn()}
        onDeny={onDeny}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ConsentDialog
        isOpen={false}
        connectionName="Hidden"
        requesterId="ext-hidden"
        onAllowOnce={vi.fn()}
        onAllowAlways={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
