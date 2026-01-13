import React, { type ReactNode, type MutableRefObject } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  initialFocus?: MutableRefObject<HTMLElement | null>;
  size?: ModalSize;
}

const MODAL_WIDTHS: Record<ModalSize, string> = {
  sm: '360px',
  md: '440px',
  lg: '560px',
  xl: '720px',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  initialFocus,
  size = 'md',
}: ModalProps) {
  const width = `min(92vw, ${MODAL_WIDTHS[size]})`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      initialFocus={initialFocus}
      className="relative"
      style={{ zIndex: 'var(--vscode-z-modal)' }}
    >
      <DialogBackdrop
        className="ui-modal-backdrop fixed inset-0 bg-[var(--color-overlay)]"
        style={{ zIndex: 'var(--vscode-z-modal)' }}
      />
      <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 'var(--vscode-z-modal)' }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel
            className="ui-modal-panel w-full rounded-sm border shadow-lg"
            style={{
              width,
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 6px 24px var(--color-shadow-medium)',
              padding: 'var(--vscode-space-4)',
            }}
          >
            <div className="flex flex-col gap-2">
              <DialogTitle
                className="font-semibold text-primary"
                style={{ fontSize: 'var(--vscode-font-size-ui)' }}
              >
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription
                  className="text-secondary"
                  style={{ fontSize: 'var(--vscode-font-size-small)' }}
                >
                  {description}
                </DialogDescription>
              )}
            </div>
            <div className="mt-4">
              {children}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
