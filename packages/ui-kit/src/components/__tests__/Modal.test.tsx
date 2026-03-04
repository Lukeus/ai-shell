import type { MutableRefObject } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders title and description when open', () => {
    render(
      <Modal
        open
        onClose={() => undefined}
        title="Delete file"
        description="This action cannot be undone."
      >
        <button type="button">Confirm</button>
      </Modal>
    );

    expect(screen.getByRole('dialog', { name: 'Delete file' })).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Hidden">
        <div>Hidden content</div>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Escape test">
        <button type="button">Confirm</button>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking outside the dialog panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Backdrop test">
        <button type="button">Confirm</button>
      </Modal>
    );

    // Headless UI Dialog detects outside clicks via pointer events on the document
    const backdrop = document.querySelector('.ui-modal-backdrop');
    expect(backdrop).toBeInTheDocument();
    fireEvent.pointerDown(backdrop as HTMLElement, { button: 0 });
    fireEvent.pointerUp(backdrop as HTMLElement, { button: 0 });
    fireEvent.click(backdrop as HTMLElement);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('focuses the initialFocus element', async () => {
    const focusRef = { current: null } as MutableRefObject<HTMLButtonElement | null>;

    render(
      <Modal open onClose={() => undefined} title="Focus test" initialFocus={focusRef}>
        <button ref={focusRef} type="button">Confirm</button>
      </Modal>
    );

    await waitFor(() => {
      expect(focusRef.current).toHaveFocus();
    });
  });
});
